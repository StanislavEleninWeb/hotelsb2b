import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ruleAppliesOn } from '@hotel/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AvailabilityQuery {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
}

export interface RoomTypeAvailability {
  roomTypeId: string;
  roomTypeName: string;
  availableRooms: number;
  ratePlans: Array<{
    ratePlanId: string;
    name: string;
    priceMinor: number;
    currency: string;
  }>;
}

/**
 * Availability + pricing. The read path (`search`) is lock-free. The write path
 * (`reserveAvailableRoom`) runs INSIDE the caller's booking transaction and uses
 * `FOR UPDATE ... SKIP LOCKED` on the physical Room rows so two concurrent bookings
 * can never grab the same inventory unit (BK-07).
 */
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private nights(checkIn: Date, checkOut: Date): Date[] {
    const out: Date[] = [];
    const d = new Date(checkIn);
    while (d < checkOut) {
      out.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  /**
   * Price a stay for one rate plan: sum of nightly prices (RateRule override else
   * base). Accepts a transaction client so callers inside `$transaction` don't
   * borrow a second pooled connection (which can deadlock under load).
   */
  async priceStay(
    ratePlanId: string,
    checkIn: Date,
    checkOut: Date,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const ratePlan = await client.ratePlan.findUniqueOrThrow({
      where: { id: ratePlanId },
      include: { rules: true },
    });
    let total = 0;
    for (const night of this.nights(checkIn, checkOut)) {
      const applicable = ratePlan.rules
        .filter(
          (r) => r.startDate <= night && r.endDate > night && ruleAppliesOn(r.daysOfWeek, night),
        )
        .sort((a, b) => b.priority - a.priority);
      total += applicable[0]?.priceMinor ?? ratePlan.basePriceMinor;
    }
    return total;
  }

  /** Read-only availability for search/detail (SD-01, SD-04). No locks. */
  async search(query: AvailabilityQuery): Promise<RoomTypeAvailability[]> {
    const { propertyId, checkIn, checkOut, adults, children } = query;

    const roomTypes = await this.prisma.roomType.findMany({
      where: {
        propertyId,
        active: true,
        maxAdults: { gte: adults },
        maxChildren: { gte: children },
      },
      include: { ratePlans: { where: { active: true } } },
    });

    const result: RoomTypeAvailability[] = [];
    for (const rt of roomTypes) {
      const availableRooms = await this.countAvailableRooms(propertyId, rt.id, checkIn, checkOut);
      if (availableRooms <= 0) continue;

      const ratePlans = [];
      for (const rp of rt.ratePlans) {
        if (rp.minStayNights > this.nights(checkIn, checkOut).length) continue;
        ratePlans.push({
          ratePlanId: rp.id,
          name: rp.name,
          priceMinor: await this.priceStay(rp.id, checkIn, checkOut),
          currency: rp.currency,
        });
      }
      if (ratePlans.length === 0) continue;
      result.push({
        roomTypeId: rt.id,
        roomTypeName: rt.name,
        availableRooms,
        ratePlans,
      });
    }
    return result;
  }

  private async countAvailableRooms(
    propertyId: string,
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM "Room" r
      WHERE r."propertyId" = ${propertyId}::uuid
        AND r."roomTypeId" = ${roomTypeId}::uuid
        AND r.active = true
        AND r.status <> 'OUT_OF_SERVICE'
        AND NOT EXISTS (${this.overlappingBookingSql(checkIn, checkOut)})
        AND NOT EXISTS (${this.overlappingBlockSql(checkIn, checkOut)})
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private overlappingBookingSql(checkIn: Date, checkOut: Date): Prisma.Sql {
    return Prisma.sql`
      SELECT 1 FROM "BookingRoom" br
      JOIN "Booking" b ON b.id = br."bookingId"
      WHERE br."roomId" = r.id
        AND b.status NOT IN ('CANCELLED', 'NO_SHOW')
        AND br."checkIn" < ${checkOut}::date
        AND br."checkOut" > ${checkIn}::date
    `;
  }

  private overlappingBlockSql(checkIn: Date, checkOut: Date): Prisma.Sql {
    return Prisma.sql`
      SELECT 1 FROM "RoomBlock" rb
      WHERE rb."roomId" = r.id
        AND rb."startDate" < ${checkOut}::date
        AND rb."endDate" > ${checkIn}::date
    `;
  }

  /**
   * Reserve ONE available physical room of the given type, locking it for the
   * lifetime of the surrounding transaction. MUST be called inside a
   * `prisma.$transaction`. `FOR UPDATE OF r SKIP LOCKED` guarantees two concurrent
   * bookings for the last room resolve to exactly one winner — the loser's SELECT
   * skips the locked row, finds nothing, and this throws ConflictException.
   */
  async reserveAvailableRoom(
    tx: Prisma.TransactionClient,
    propertyId: string,
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT r.id::text AS id
      FROM "Room" r
      WHERE r."propertyId" = ${propertyId}::uuid
        AND r."roomTypeId" = ${roomTypeId}::uuid
        AND r.active = true
        AND r.status <> 'OUT_OF_SERVICE'
        AND NOT EXISTS (${this.overlappingBookingSql(checkIn, checkOut)})
        AND NOT EXISTS (${this.overlappingBlockSql(checkIn, checkOut)})
      ORDER BY r.number
      FOR UPDATE OF r SKIP LOCKED
      LIMIT 1
    `;
    const roomId = rows[0]?.id;
    if (!roomId) {
      throw new ConflictException('No availability for the selected room type and dates');
    }
    return roomId;
  }
}

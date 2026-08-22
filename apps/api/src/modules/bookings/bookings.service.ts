import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { ActionContext } from '../../common/action-context';
import { generateConfirmationCode } from '../../common/confirmation-code';
import { assertTransition } from './booking-state-machine';
import { CreateBookingDto } from './dto/create-booking.dto';

const CONFIRMATION_RETRIES = 5;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  private toDate(iso: string): Date {
    // Date-only semantics: normalize to midnight UTC.
    return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  }

  private nightsBetween(checkIn: Date, checkOut: Date): number {
    return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  }

  async create(dto: CreateBookingDto, ctx: ActionContext): Promise<Booking> {
    const checkIn = this.toDate(dto.checkIn);
    const checkOut = this.toDate(dto.checkOut);
    if (this.nightsBetween(checkIn, checkOut) < 1) {
      throw new BadRequestException('checkOut must be at least one night after checkIn');
    }

    const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
    if (!property || !property.active) throw new NotFoundException('Property not found');

    // Resolve rate plans up-front and enforce single-currency-per-booking (invariant).
    const ratePlanIds = dto.rooms.map((r) => r.ratePlanId);
    const ratePlans = await this.prisma.ratePlan.findMany({
      where: { id: { in: ratePlanIds }, propertyId: dto.propertyId, active: true },
    });
    const rpById = new Map(ratePlans.map((rp) => [rp.id, rp]));
    for (const room of dto.rooms) {
      const rp = rpById.get(room.ratePlanId);
      if (!rp) throw new BadRequestException(`Unknown or inactive rate plan ${room.ratePlanId}`);
      if (rp.roomTypeId !== room.roomTypeId) {
        throw new BadRequestException('Rate plan does not belong to the requested room type');
      }
      if (rp.currency !== property.currency) {
        throw new BadRequestException('All rate plans must match the property currency');
      }
    }

    // Interactive transaction: reserve a physical room per requested room (locking),
    // price it, then write the booking. If any room can't be reserved the whole
    // transaction rolls back — no partial bookings, no double-books (BK-07).
    const created = await this.prisma.$transaction(async (tx) => {
      // Guest identity resolution (MIGRATION-PLAN invariant #1, hardened per review):
      // link to an existing guest ONLY when the requester is authenticated as that
      // guest — so booking history accrues on the account (ST-12) without letting an
      // anonymous request attach a booking to someone else's account by email.
      const authedGuest = ctx.actorGuestId
        ? await tx.guest.findUnique({ where: { id: ctx.actorGuestId } })
        : null;
      const guest =
        authedGuest ??
        (await tx.guest.create({
          data: {
            firstName: dto.primaryGuest.firstName,
            lastName: dto.primaryGuest.lastName,
            email: dto.primaryGuest.email ?? null,
            phone: dto.primaryGuest.phone ?? null,
          },
        }));

      const roomInputs: Prisma.BookingRoomCreateManyBookingInput[] = [];
      let subtotal = 0;
      for (const room of dto.rooms) {
        const roomId = await this.availability.reserveAvailableRoom(
          tx,
          dto.propertyId,
          room.roomTypeId,
          checkIn,
          checkOut,
        );
        const priceMinor = await this.availability.priceStay(
          room.ratePlanId,
          checkIn,
          checkOut,
          tx,
        );
        subtotal += priceMinor;
        roomInputs.push({
          propertyId: dto.propertyId,
          roomTypeId: room.roomTypeId,
          ratePlanId: room.ratePlanId,
          roomId,
          checkIn,
          checkOut,
          adults: room.adults,
          children: room.children,
          priceMinor,
          currency: property.currency,
        });
      }

      const baseData: Omit<Prisma.BookingCreateInput, 'confirmationCode'> = {
        status: BookingStatus.PENDING_PAYMENT,
        channel: ctx.channel,
        checkIn,
        checkOut,
        adults: dto.rooms.reduce((s, r) => s + r.adults, 0),
        children: dto.rooms.reduce((s, r) => s + r.children, 0),
        roomsCount: dto.rooms.length,
        currency: property.currency,
        subtotalMinor: subtotal,
        totalMinor: subtotal, // taxes/discounts applied in later phases
        specialRequests: dto.specialRequests ?? null,
        property: { connect: { id: dto.propertyId } },
        primaryGuest: { connect: { id: guest.id } },
        ...(ctx.actorUserId ? { createdByUser: { connect: { id: ctx.actorUserId } } } : {}),
        rooms: { createMany: { data: roomInputs } },
        occupants: {
          create: {
            firstName: dto.primaryGuest.firstName,
            lastName: dto.primaryGuest.lastName,
            isPrimary: true,
          },
        },
      };

      return this.insertWithUniqueCode(tx, baseData);
    });

    return created;
  }

  private async insertWithUniqueCode(
    tx: Prisma.TransactionClient,
    baseData: Omit<Prisma.BookingCreateInput, 'confirmationCode'>,
  ): Promise<Booking> {
    for (let attempt = 0; attempt < CONFIRMATION_RETRIES; attempt++) {
      try {
        return await tx.booking.create({
          data: { ...baseData, confirmationCode: generateConfirmationCode() },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < CONFIRMATION_RETRIES - 1
        ) {
          continue; // confirmation-code collision — retry with a new code
        }
        throw err;
      }
    }
    throw new Error('Could not allocate a unique confirmation code');
  }

  async findByIdOrThrow(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { rooms: true, payments: true, occupants: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  /** MG-01: confirmation code + last-name lookup (no account). */
  async lookup(confirmationCode: string, lastName: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { confirmationCode: confirmationCode.toUpperCase() },
      include: { rooms: true, primaryGuest: true },
    });
    if (
      !booking ||
      booking.primaryGuest.lastName.toLowerCase() !== lastName.trim().toLowerCase()
    ) {
      // Same response whether not-found or name-mismatch — don't leak existence.
      throw new NotFoundException('No booking matches those details');
    }
    return booking;
  }

  /**
   * Guarded status transition (confirm / check-in / check-out / no-show / cancel).
   * The acting user/channel is captured by the AuditLogInterceptor from the request.
   */
  async transition(id: string, to: BookingStatus, reason?: string): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    assertTransition(booking.status, to);
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: to,
        ...(to === BookingStatus.CANCELLED
          ? { cancelledAt: new Date(), cancelReason: reason ?? null }
          : {}),
      },
    });
  }

  async cancel(id: string, reason?: string): Promise<Booking> {
    return this.transition(id, BookingStatus.CANCELLED, reason);
  }
}

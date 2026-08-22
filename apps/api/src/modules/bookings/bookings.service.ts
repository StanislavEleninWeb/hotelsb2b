import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Booking, BookingRoom, BookingStatus, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { CacheService } from '../../cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly cache: CacheService,
    private readonly notifications: NotificationsService,
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
    const notificationIds: string[] = [];
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

      const booking = await this.insertWithUniqueCode(tx, baseData);
      // AI-06 / BK-08: acknowledge receipt (awaiting payment). Row written in-tx.
      const n = await this.notifications.createForBooking(
        tx,
        booking,
        NotificationType.BOOKING_RECEIVED,
        guest.email,
      );
      notificationIds.push(n.id);
      return booking;
    });

    for (const nid of notificationIds) await this.notifications.enqueue(nid);
    // A new booking consumes inventory — invalidate that property's availability cache.
    await this.cache.bumpProperty(dto.propertyId);
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

  /** Staff calendar (ST-02): active bookings overlapping a property's date window. */
  listForProperty(propertyId: string, from: Date, to: Date): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: {
        propertyId,
        checkIn: { lt: to },
        checkOut: { gt: from },
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
      },
      orderBy: { checkIn: 'asc' },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true } },
        rooms: {
          include: {
            roomType: { select: { name: true } },
            room: { select: { number: true } },
          },
        },
      },
    });
  }

  /** Audit trail for a booking (ST-17) — surfaced in the staff UI per mutation. */
  auditTrail(bookingId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType: 'Booking', entityId: bookingId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Assign a physical room to a BookingRoom (ST-05), concurrency-safe. Locks the
   * SPECIFIC target room row (FOR UPDATE — not SKIP LOCKED, which is for picking any
   * free room), so two staff assigning the same room to overlapping bookings
   * serialize and exactly one wins; the other sees the committed assignment and 409s.
   */
  async assignRoom(bookingRoomId: string, roomId: string): Promise<BookingRoom> {
    return this.prisma.$transaction(async (tx) => {
      const br = await tx.bookingRoom.findUnique({
        where: { id: bookingRoomId },
        include: { booking: { select: { status: true } } },
      });
      if (!br) throw new NotFoundException('Booking room not found');
      if (br.booking.status === BookingStatus.CANCELLED || br.booking.status === BookingStatus.NO_SHOW) {
        throw new BadRequestException('Booking is not active');
      }

      const rows = await tx.$queryRaw<
        Array<{ id: string; propertyId: string; roomTypeId: string; status: string; active: boolean }>
      >`
        SELECT id::text AS id, "propertyId"::text AS "propertyId",
               "roomTypeId"::text AS "roomTypeId", status::text AS status, active
        FROM "Room" WHERE id = ${roomId}::uuid FOR UPDATE
      `;
      const room = rows[0];
      if (!room) throw new NotFoundException('Room not found');
      if (!room.active || room.status === 'OUT_OF_SERVICE') {
        throw new BadRequestException('Room is not assignable');
      }
      if (room.propertyId !== br.propertyId) {
        throw new BadRequestException('Room belongs to a different property');
      }
      if (room.roomTypeId !== br.roomTypeId) {
        throw new BadRequestException('Room type does not match the booked room type');
      }

      const clashBooking = await tx.bookingRoom.findFirst({
        where: {
          roomId,
          id: { not: bookingRoomId },
          checkIn: { lt: br.checkOut },
          checkOut: { gt: br.checkIn },
          booking: {
            status: {
              in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
            },
          },
        },
      });
      if (clashBooking) throw new ConflictException('That room is already assigned for overlapping dates');

      const clashBlock = await tx.roomBlock.findFirst({
        where: { roomId, startDate: { lt: br.checkOut }, endDate: { gt: br.checkIn } },
      });
      if (clashBlock) throw new ConflictException('That room is blocked for these dates');

      return tx.bookingRoom.update({ where: { id: bookingRoomId }, data: { roomId } });
    });
  }

  /** MG-02: a logged-in guest's own bookings. */
  listForGuest(guestId: string): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: { primaryGuestId: guestId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { name: true } },
        rooms: { include: { roomType: { select: { name: true } } } },
      },
    });
  }

  async findByIdOrThrow(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        occupants: true,
        payments: true,
        property: { select: { name: true, checkInTime: true, checkOutTime: true } },
        rooms: {
          include: {
            roomType: { select: { name: true } },
            room: { select: { number: true } },
            ratePlan: {
              select: { name: true, cancellationPolicy: true, refundableUntilHrs: true },
            },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  /**
   * MG-04: show the refund before confirming a cancellation. Refund logic lives
   * here (the API), not the web app, so the AI assistant reuses it (invariant #6).
   */
  async cancellationPreview(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { rooms: { include: { ratePlan: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const now = Date.now();
    let refundableMinor = 0;
    const rooms = booking.rooms.map((r) => {
      const rp = r.ratePlan;
      let refundable = rp.cancellationPolicy === 'REFUNDABLE';
      if (refundable && rp.refundableUntilHrs != null) {
        const deadline = r.checkIn.getTime() - rp.refundableUntilHrs * 3_600_000;
        if (now > deadline) refundable = false;
      }
      const amount = refundable ? r.priceMinor : 0;
      refundableMinor += amount;
      return {
        bookingRoomId: r.id,
        policy: rp.cancellationPolicy,
        priceMinor: r.priceMinor,
        refundableMinor: amount,
      };
    });

    return {
      currency: booking.currency,
      totalMinor: booking.totalMinor,
      refundableMinor,
      nonRefundableMinor: booking.totalMinor - refundableMinor,
      rooms,
    };
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
    const current = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, propertyId: true, primaryGuest: { select: { email: true } } },
    });
    if (!current) throw new NotFoundException('Booking not found');
    assertTransition(current.status, to);

    const notificationIds: string[] = [];
    // Write the Notification row IN the transaction (source of truth); enqueue after.
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id },
        data: {
          status: to,
          ...(to === BookingStatus.CANCELLED
            ? { cancelledAt: new Date(), cancelReason: reason ?? null }
            : {}),
        },
      });
      const type =
        to === BookingStatus.CONFIRMED
          ? NotificationType.BOOKING_CONFIRMED
          : to === BookingStatus.CANCELLED
            ? NotificationType.BOOKING_CANCELLED
            : null;
      if (type) {
        const n = await this.notifications.createForBooking(tx, booking, type, current.primaryGuest.email);
        notificationIds.push(n.id);
      }
      return booking;
    });

    for (const nid of notificationIds) await this.notifications.enqueue(nid);
    // Cancel / no-show free inventory → invalidate the property's availability cache.
    if (to === BookingStatus.CANCELLED || to === BookingStatus.NO_SHOW) {
      await this.cache.bumpProperty(current.propertyId);
    }
    return updated;
  }

  async cancel(id: string, reason?: string): Promise<Booking> {
    return this.transition(id, BookingStatus.CANCELLED, reason);
  }
}

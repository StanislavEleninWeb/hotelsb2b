import { ConflictException } from '@nestjs/common';
import { CancellationPolicy, Channel, PaymentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ActionContext } from '../../common/action-context';

// The BK-07 guarantee: two guests racing for the LAST available room of a type —
// exactly one booking succeeds, the other gets a ConflictException. Exercises the
// `FOR UPDATE ... SKIP LOCKED` reservation in AvailabilityService against a real
// Postgres (docker compose up).
describe('Booking concurrency (BK-07)', () => {
  const prisma = new PrismaService();
  const availability = new AvailabilityService(prisma);
  const bookings = new BookingsService(prisma, availability);
  const ctx: ActionContext = { channel: Channel.WEB };

  let propertyId: string;
  let roomTypeId: string;
  let ratePlanId: string;
  const slug = `concurrency-test-${Date.now()}`;

  beforeAll(async () => {
    await prisma.$connect();
    // Seed a property with a room type that has exactly ONE physical room.
    const property = await prisma.property.create({
      data: { slug, name: 'Concurrency Test Hotel', currency: 'EUR' },
    });
    propertyId = property.id;

    const roomType = await prisma.roomType.create({
      data: { propertyId, slug: 'std', name: 'Standard', maxAdults: 2, maxChildren: 0 },
    });
    roomTypeId = roomType.id;

    const ratePlan = await prisma.ratePlan.create({
      data: {
        propertyId,
        roomTypeId,
        name: 'Flexible',
        cancellationPolicy: CancellationPolicy.REFUNDABLE,
        paymentType: PaymentType.FULL,
        minStayNights: 1,
        basePriceMinor: 12000,
        currency: 'EUR',
      },
    });
    ratePlanId = ratePlan.id;

    // Exactly one room — the contested inventory unit.
    await prisma.room.create({
      data: { propertyId, roomTypeId, number: '101' },
    });
  });

  afterAll(async () => {
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('lets exactly one of two simultaneous bookings win the last room', async () => {
    const dto: CreateBookingDto = {
      propertyId,
      checkIn: '2027-01-10',
      checkOut: '2027-01-12',
      rooms: [{ roomTypeId, ratePlanId, adults: 2, children: 0 }],
      primaryGuest: { firstName: 'Racer', lastName: 'One' },
    };

    const results = await Promise.allSettled([
      bookings.create(dto, ctx),
      bookings.create({ ...dto, primaryGuest: { firstName: 'Racer', lastName: 'Two' } }, ctx),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    // And the database holds exactly one booking for this property.
    const count = await prisma.booking.count({ where: { propertyId } });
    expect(count).toBe(1);
  });

  it('rejects a second booking for the same room/dates after the first is confirmed', async () => {
    const dto: CreateBookingDto = {
      propertyId,
      checkIn: '2027-02-01',
      checkOut: '2027-02-03',
      rooms: [{ roomTypeId, ratePlanId, adults: 1, children: 0 }],
      primaryGuest: { firstName: 'Sequential', lastName: 'Guest' },
    };

    await bookings.create(dto, ctx); // takes the only room
    await expect(bookings.create(dto, ctx)).rejects.toBeInstanceOf(ConflictException);
  });
});

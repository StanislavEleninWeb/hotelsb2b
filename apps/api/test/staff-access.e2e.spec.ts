import { INestApplication, ValidationPipe, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';

// Phase 6: staff property-scope (BOLA) on inventory endpoints + concurrency-safe
// physical-room assignment.
describe('Staff access control & room assignment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookings: BookingsService;
  const pw = new PasswordService();
  const suffix = Date.now();
  const staffEmail = `fd-${suffix}@hotel.test`;
  const password = 'correct-horse-battery';

  let propAId: string;
  let propBId: string;
  let roomBId: string;
  let roomAId: string;
  let brId1: string;
  let brId2: string;

  const code = () => `SC${suffix}${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    bookings = app.get(BookingsService);

    const propA = await prisma.property.create({ data: { slug: `sa-${suffix}`, name: 'A', currency: 'EUR' } });
    const propB = await prisma.property.create({ data: { slug: `sb-${suffix}`, name: 'B', currency: 'EUR' } });
    propAId = propA.id;
    propBId = propB.id;

    const rtA = await prisma.roomType.create({ data: { propertyId: propA.id, slug: 'std', name: 'Std', maxAdults: 2 } });
    const rpA = await prisma.ratePlan.create({
      data: { propertyId: propA.id, roomTypeId: rtA.id, name: 'Flex', cancellationPolicy: 'REFUNDABLE', paymentType: 'FULL', minStayNights: 1, basePriceMinor: 10000, currency: 'EUR' },
    });
    const roomA = await prisma.room.create({ data: { propertyId: propA.id, roomTypeId: rtA.id, number: 'A1' } });
    roomAId = roomA.id;

    const rtB = await prisma.roomType.create({ data: { propertyId: propB.id, slug: 'std', name: 'Std', maxAdults: 2 } });
    const roomB = await prisma.room.create({ data: { propertyId: propB.id, roomTypeId: rtB.id, number: 'B1' } });
    roomBId = roomB.id;

    const guest = await prisma.guest.create({ data: { firstName: 'G', lastName: 'One' } });

    // Two overlapping unassigned bookings in property A competing for room A1.
    async function seedBookingRoom(): Promise<string> {
      const b = await prisma.booking.create({
        data: {
          propertyId: propA.id,
          confirmationCode: code(),
          currency: 'EUR',
          primaryGuestId: guest.id,
          checkIn: new Date('2027-08-01'),
          checkOut: new Date('2027-08-05'),
          status: 'CONFIRMED',
          rooms: {
            create: {
              propertyId: propA.id,
              roomTypeId: rtA.id,
              ratePlanId: rpA.id,
              checkIn: new Date('2027-08-01'),
              checkOut: new Date('2027-08-05'),
              adults: 2,
              children: 0,
              priceMinor: 40000,
              currency: 'EUR',
            },
          },
        },
        include: { rooms: true },
      });
      return b.rooms[0]!.id;
    }
    brId1 = await seedBookingRoom();
    brId2 = await seedBookingRoom();

    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await pw.hash(password),
        firstName: 'Front',
        lastName: 'Desk',
        role: 'FRONT_DESK',
        propertyAccess: { create: { propertyId: propA.id } },
      },
    });
  });

  afterAll(async () => {
    await prisma.property.deleteMany({ where: { id: { in: [propAId, propBId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: staffEmail } }).catch(() => {});
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  async function token(): Promise<string> {
    const res = await http().post('/api/v1/auth/staff/login').send({ email: staffEmail, password, mode: 'bearer' });
    return res.body.accessToken as string;
  }

  it('front-desk scoped to A can list A’s rooms (200) but not B’s (403)', async () => {
    const t = await token();
    await http().get(`/api/v1/rooms/by-property/${propAId}`).set('Authorization', `Bearer ${t}`).expect(200);
    await http().get(`/api/v1/rooms/by-property/${propBId}`).set('Authorization', `Bearer ${t}`).expect(403);
  });

  it('front-desk scoped to A cannot PATCH a room in B (403)', async () => {
    const t = await token();
    await http()
      .patch(`/api/v1/rooms/${roomBId}`)
      .set('Authorization', `Bearer ${t}`)
      .send({ status: 'OUT_OF_SERVICE' })
      .expect(403);
  });

  it('two concurrent assignments of the same room to overlapping bookings — exactly one wins', async () => {
    const results = await Promise.allSettled([
      bookings.assignRoom(brId1, roomAId),
      bookings.assignRoom(brId2, roomAId),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
  });
});

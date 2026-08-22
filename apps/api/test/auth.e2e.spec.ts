import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';

// HTTP-level auth + access-control tests. Guards only run in the request pipeline,
// so these go through supertest with real signed tokens — the gate item.
describe('Auth & access control (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const pw = new PasswordService();

  const suffix = Date.now();
  const staffEmail = `frontdesk-${suffix}@hotel.test`;
  const guestEmail = `guest-${suffix}@hotel.test`;
  const password = 'correct-horse-battery';

  let propAId: string;
  let propBId: string;
  let bookingAId: string; // property A, owned by our guest account
  let bookingBId: string; // property B, owned by someone else

  const code = () => randomBytes(5).toString('hex').toUpperCase();

  async function seedBooking(propertyId: string, guestId: string): Promise<string> {
    const b = await prisma.booking.create({
      data: {
        propertyId,
        confirmationCode: code(),
        currency: 'EUR',
        primaryGuestId: guestId,
        checkIn: new Date('2027-06-01'),
        checkOut: new Date('2027-06-03'),
      },
    });
    return b.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const propA = await prisma.property.create({ data: { slug: `a-${suffix}`, name: 'A', currency: 'EUR' } });
    const propB = await prisma.property.create({ data: { slug: `b-${suffix}`, name: 'B', currency: 'EUR' } });
    propAId = propA.id;
    propBId = propB.id;

    // Front-desk staff scoped to property A only.
    const staff = await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await pw.hash(password),
        firstName: 'Front',
        lastName: 'Desk',
        role: 'FRONT_DESK',
        propertyAccess: { create: { propertyId: propA.id } },
      },
    });
    expect(staff.id).toBeDefined();

    const guestAccount = await prisma.guest.create({
      data: {
        email: guestEmail,
        passwordHash: await pw.hash(password),
        firstName: 'Reg',
        lastName: 'Ular',
        isAccount: true,
      },
    });
    const otherGuest = await prisma.guest.create({
      data: { firstName: 'Some', lastName: 'One', isAccount: false },
    });

    bookingAId = await seedBooking(propA.id, guestAccount.id);
    bookingBId = await seedBooking(propB.id, otherGuest.id);
  });

  afterAll(async () => {
    await prisma.property.deleteMany({ where: { id: { in: [propAId, propBId] } } }).catch(() => {});
    await prisma.guest.deleteMany({ where: { email: { in: [guestEmail] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: staffEmail } }).catch(() => {});
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function login(path: string, email: string): Promise<string> {
    const res = await http().post(`/api/v1/auth/${path}`).send({ email, password, mode: 'bearer' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    return res.body.accessToken as string;
  }

  it('rejects login with a wrong password (401)', async () => {
    await http()
      .post('/api/v1/auth/staff/login')
      .send({ email: staffEmail, password: 'wrong', mode: 'bearer' })
      .expect(401);
  });

  it('GET /auth/me returns the authenticated staff user', async () => {
    const token = await login('staff/login', staffEmail);
    const res = await http().get('/api/v1/auth/me').set(bearer(token)).expect(200);
    expect(res.body).toMatchObject({ kind: 'staff', email: staffEmail, role: 'FRONT_DESK' });
  });

  it('staff scoped to Property A can read a Property-A booking (200)', async () => {
    const token = await login('staff/login', staffEmail);
    await http().get(`/api/v1/bookings/${bookingAId}`).set(bearer(token)).expect(200);
  });

  it('GATE: staff scoped to Property A gets 403 on a Property-B booking with a valid token', async () => {
    const token = await login('staff/login', staffEmail);
    await http().get(`/api/v1/bookings/${bookingBId}`).set(bearer(token)).expect(403);
  });

  it('an unauthenticated request for a booking is 401', async () => {
    await http().get(`/api/v1/bookings/${bookingAId}`).expect(401);
  });

  it('a guest can read their OWN booking (200) but not another guest’s (404)', async () => {
    const token = await login('login', guestEmail);
    await http().get(`/api/v1/bookings/${bookingAId}`).set(bearer(token)).expect(200);
    await http().get(`/api/v1/bookings/${bookingBId}`).set(bearer(token)).expect(404);
  });

  it('a garbage booking id is 400, not a 500', async () => {
    const token = await login('staff/login', staffEmail);
    await http().get('/api/v1/bookings/not-a-uuid').set(bearer(token)).expect(400);
  });
});

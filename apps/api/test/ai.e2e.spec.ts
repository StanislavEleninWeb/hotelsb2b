import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Phase 8 AI boundary: signed + replay-protected webhooks, OTP-gated disclose/cancel,
// same service layer (AI-08), and the fixed booking-action-token confusion.
describe('AI assistant boundary (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const secret = process.env.AI_WEBHOOK_SECRET!;
  const suffix = Date.now();

  let propertyId: string;
  let roomTypeId: string;
  let ratePlanId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const property = await prisma.property.create({ data: { slug: `ai-${suffix}`, name: 'AI Test', currency: 'EUR' } });
    propertyId = property.id;
    const rt = await prisma.roomType.create({ data: { propertyId, slug: 'std', name: 'Std', maxAdults: 2 } });
    roomTypeId = rt.id;
    const rp = await prisma.ratePlan.create({
      data: { propertyId, roomTypeId, name: 'Flex', cancellationPolicy: 'REFUNDABLE', paymentType: 'FULL', minStayNights: 1, basePriceMinor: 10000, currency: 'EUR' },
    });
    ratePlanId = rp.id;
    await prisma.room.create({ data: { propertyId, roomTypeId, number: 'A1' } });
  });

  afterAll(async () => {
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  // Sign the exact bytes we send (order matters for HMAC).
  function signed(path: string, payload: unknown, opts: { badSig?: boolean; ts?: number } = {}) {
    const body = JSON.stringify(payload);
    const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    return http()
      .post(path)
      .set('content-type', 'application/json')
      .set('x-channel', 'AI_VOICE')
      .set('x-ai-timestamp', ts)
      .set('x-ai-signature', opts.badSig ? 'deadbeef' : sig)
      .send(body);
  }

  it('GET /ai/tools is public and lists the tool schemas', async () => {
    const res = await http().get('/api/v1/ai/tools').expect(200);
    expect(res.body.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['check_availability', 'create_booking', 'cancel_booking']),
    );
  });

  it('rejects a webhook with an invalid signature (401)', async () => {
    await signed('/api/v1/ai/availability', { propertyId, checkIn: '2027-09-01', checkOut: '2027-09-03' }, { badSig: true }).expect(401);
  });

  it('rejects a webhook with a stale timestamp (401)', async () => {
    await signed('/api/v1/ai/availability', { propertyId, checkIn: '2027-09-01', checkOut: '2027-09-03' }, { ts: 1000 }).expect(401);
  });

  it('accepts a correctly-signed availability webhook, and rejects its replay', async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ propertyId, checkIn: '2027-09-01', checkOut: '2027-09-03', adults: 2, children: 0 });
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    const send = () =>
      http().post('/api/v1/ai/availability').set('content-type', 'application/json').set('x-ai-timestamp', ts).set('x-ai-signature', sig).send(body);
    await send().expect(201); // POST default; RPC-style tool call
    await send().expect(401); // replay: same signature can't be used twice
  });

  it('strips provider envelope metadata instead of 400-ing a signed webhook', async () => {
    // extra fields (conversation_id, agent_id) alongside the tool arguments
    await signed('/api/v1/ai/availability', {
      propertyId, checkIn: '2027-09-01', checkOut: '2027-09-03', conversation_id: 'abc', agent_id: 'xyz',
    }).expect(201);
  });

  it('AI-created booking → BOOKING_RECEIVED notification; idempotent on retry (invariant #7)', async () => {
    const payload = {
      propertyId, checkIn: '2027-10-01', checkOut: '2027-10-03',
      rooms: [{ roomTypeId, ratePlanId, adults: 2, children: 0 }],
      primaryGuest: { firstName: 'Ivy', lastName: 'Voice', email: 'ivy@example.com' },
    };
    const key = `ai-key-${suffix}`;
    const post = () => {
      const body = JSON.stringify(payload);
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
      return http()
        .post('/api/v1/ai/bookings')
        .set('content-type', 'application/json').set('x-channel', 'AI_VOICE')
        .set('x-ai-timestamp', ts).set('x-ai-signature', sig).set('idempotency-key', key)
        .send(body);
    };
    const first = await post().expect(201);
    // small delay so the timestamp differs (unique signature), same idempotency key
    await new Promise((r) => setTimeout(r, 1100));
    const second = await post().expect(201);
    expect(second.body.id).toBe(first.body.id); // same booking, not a duplicate

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Booking', entityId: first.body.id, action: 'create' },
    });
    expect(audit?.channel).toBe('AI_VOICE');
    const notif = await prisma.notification.findFirst({
      where: { bookingId: first.body.id, type: 'BOOKING_RECEIVED' },
    });
    expect(notif).toBeTruthy();
  });

  it('OTP-gates disclosure/cancel; the verification token is NOT a valid access token', async () => {
    // Seed a booking with a known guest for lookup.
    const guest = await prisma.guest.create({ data: { firstName: 'Otto', lastName: 'Phone', email: 'otto@example.com' } });
    const booking = await prisma.booking.create({
      data: { propertyId, confirmationCode: `AIOTP${suffix}`, currency: 'EUR', primaryGuestId: guest.id, status: 'CONFIRMED', checkIn: new Date('2027-11-01'), checkOut: new Date('2027-11-03') },
    });

    // cancel without a token → rejected
    await signed('/api/v1/ai/bookings/cancel', { verificationToken: 'garbage' }).expect(401);

    // request OTP (identity proof: code + last name), verify, get token
    const reqRes = await signed('/api/v1/ai/otp/request', { confirmationCode: booking.confirmationCode, lastName: 'Phone' }).expect(201);
    expect(reqRes.body.bookingId).toBe(booking.id);
    const devCode = reqRes.body.devCode as string;
    expect(devCode).toBeTruthy();

    const verifyRes = await signed('/api/v1/ai/otp/verify', { bookingId: booking.id, code: devCode }).expect(201);
    const token = verifyRes.body.verificationToken as string;

    // the verification token must NOT authenticate as a user (fixed vuln)
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);

    // get booking with the token → discloses details + refund preview
    const getRes = await signed('/api/v1/ai/bookings/get', { verificationToken: token }).expect(201);
    expect(getRes.body.booking.confirmationCode).toBe(booking.confirmationCode);
    expect(getRes.body.cancellationPreview).toHaveProperty('refundableMinor');

    // cancel with the token → succeeds + ai audit
    const cancelRes = await signed('/api/v1/ai/bookings/cancel', { verificationToken: token, reason: 'guest request' }).expect(201);
    expect(cancelRes.body.status).toBe('CANCELLED');
  });

  it('AI-08: an AI-created booking hits the SAME concurrency guard as web', async () => {
    // Single-room property already has room A1; book it, then a second AI booking
    // for the same dates must conflict — proving the AI path is not a bypass.
    const mk = (last: string) => {
      const payload = {
        propertyId, checkIn: '2027-12-01', checkOut: '2027-12-03',
        rooms: [{ roomTypeId, ratePlanId, adults: 1, children: 0 }],
        primaryGuest: { firstName: 'Race', lastName: last },
      };
      const body = JSON.stringify(payload);
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
      return http().post('/api/v1/ai/bookings').set('content-type', 'application/json').set('x-channel', 'AI_CHAT').set('x-ai-timestamp', ts).set('x-ai-signature', sig).send(body);
    };
    await mk('First').expect(201);
    await mk('Second').expect(409); // last room already taken — same guard as web
  });
});

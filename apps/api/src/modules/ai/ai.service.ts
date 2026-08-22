import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Booking } from '@prisma/client';
import type Redis from 'ioredis';
import type { ZodType } from 'zod';
import {
  AiAvailabilitySchema,
  AiBookingActionSchema,
  AiOtpRequestSchema,
  AiOtpVerifySchema,
  CreateBookingSchema,
} from '@hotel/shared';
import { AvailabilityService, RoomTypeAvailability } from '../availability/availability.service';
import { BookingsService } from '../bookings/bookings.service';
import type { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { AuthService } from '../../auth/auth.service';
import { TokenService } from '../../auth/token.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { REDIS } from '../../redis/redis.module';
import { ActionContext } from '../../common/action-context';

const OTP_REQUESTS_PER_BOOKING = 5;
const OTP_REQUEST_WINDOW_SECONDS = 3600;

// Thin orchestration over the SAME services the web/staff API uses (AI-08). Tool
// payloads are validated with the SHARED Zod schemas (same shapes as web) — Zod
// strips provider envelope metadata instead of rejecting it.
@Injectable()
export class AiService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly bookings: BookingsService,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly idempotency: IdempotencyService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private parse<T>(schema: ZodType<T>, body: unknown): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i) => i.message).join(', '));
    }
    return result.data;
  }

  private toDate(iso: string): Date {
    return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  }

  checkAvailability(body: unknown): Promise<RoomTypeAvailability[]> {
    const dto = this.parse(AiAvailabilitySchema, body);
    return this.availability.search({
      propertyId: dto.propertyId,
      checkIn: this.toDate(dto.checkIn),
      checkOut: this.toDate(dto.checkOut),
      adults: dto.adults ?? 2,
      children: dto.children ?? 0,
    });
  }

  // Idempotency-Key MUST be stable per booking attempt (webhook retries → one
  // booking, invariant #7). Fingerprint-bound (422 on payload mismatch).
  createBooking(body: unknown, idempotencyKey: string | undefined, ctx: ActionContext): Promise<Booking> {
    const dto = this.parse(CreateBookingSchema, body);
    const fingerprint = IdempotencyService.fingerprint(['ai POST /bookings', dto]);
    return this.idempotency.execute(idempotencyKey, fingerprint, () =>
      this.bookings.create(dto as CreateBookingDto, ctx),
    );
  }

  // Identity proof: confirmation code + last name must match, then OTP to the
  // contact ON FILE (never a request-supplied destination — §5.4). Per-booking cap.
  async requestOtp(body: unknown): Promise<{ bookingId: string; devCode?: string }> {
    const { confirmationCode, lastName } = this.parse(AiOtpRequestSchema, body);
    const booking = await this.bookings.lookup(confirmationCode, lastName); // 404 if no match
    const count = await this.redis.incr(`ai-otp-req:${booking.id}`);
    if (count === 1) await this.redis.expire(`ai-otp-req:${booking.id}`, OTP_REQUEST_WINDOW_SECONDS);
    if (count > OTP_REQUESTS_PER_BOOKING) {
      throw new HttpException('Too many verification attempts for this booking', HttpStatus.TOO_MANY_REQUESTS);
    }
    const { devCode } = await this.auth.requestBookingOtp(booking.id);
    return { bookingId: booking.id, devCode };
  }

  verifyOtp(body: unknown): Promise<{ verificationToken: string }> {
    const { bookingId, code } = this.parse(AiOtpVerifySchema, body);
    return this.auth.verifyBookingOtp(bookingId, code);
  }

  async getBooking(body: unknown) {
    const { verificationToken } = this.parse(AiBookingActionSchema, body);
    const { bookingId } = this.tokens.verifyBookingActionToken(verificationToken);
    const [booking, cancellationPreview] = await Promise.all([
      this.bookings.findByIdOrThrow(bookingId),
      this.bookings.cancellationPreview(bookingId),
    ]);
    return { booking, cancellationPreview };
  }

  cancelBooking(body: unknown): Promise<Booking> {
    const { verificationToken, reason } = this.parse(AiBookingActionSchema, body);
    const { bookingId } = this.tokens.verifyBookingActionToken(verificationToken);
    return this.bookings.cancel(bookingId, reason);
  }
}

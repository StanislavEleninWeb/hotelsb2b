import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OtpPurpose, Prisma } from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const CODE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  constructor(private readonly prisma: PrismaService) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  // In non-production the code is returned/logged so it can be used in dev + tests.
  // In production it is only delivered via the notification channel (Phase 7).
  private devReveal(code: string, destination: string): string | undefined {
    if (process.env.NODE_ENV === 'production') return undefined;
    this.logger.debug(`OTP for ${destination}: ${code}`);
    return code;
  }

  /** Passwordless login: send a code to a guest ACCOUNT's email. */
  async issueLoginOtp(email: string): Promise<{ devCode?: string }> {
    const guest = await this.prisma.guest.findFirst({ where: { email, isAccount: true } });
    // Do not reveal whether the account exists; act the same either way.
    if (!guest) return {};
    const code = this.generateCode();
    await this.prisma.otpCode.create({
      data: {
        purpose: OtpPurpose.LOGIN,
        codeHash: this.hash(code),
        guestId: guest.id,
        destination: email,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    return { devCode: this.devReveal(code, email) };
  }

  async verifyLoginOtp(email: string, code: string): Promise<string> {
    const guest = await this.prisma.guest.findFirst({ where: { email, isAccount: true } });
    if (!guest) throw new BadRequestException('Invalid code');
    const guestId = guest.id;
    return this.consume({ purpose: OtpPurpose.LOGIN, guestId }, code, () => guestId);
  }

  /** Booking-action verification: send a code to the contact ON THE BOOKING record. */
  async issueBookingOtp(bookingId: string): Promise<{ devCode?: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { primaryGuest: true },
    });
    if (!booking) throw new BadRequestException('Booking not found');
    // Destination comes from the record, never the request (§5.4 caller-id spoofing).
    const destination = booking.primaryGuest.email ?? booking.primaryGuest.phone;
    if (!destination) throw new BadRequestException('No contact on file for this booking');
    const code = this.generateCode();
    await this.prisma.otpCode.create({
      data: {
        purpose: OtpPurpose.BOOKING_ACTION,
        codeHash: this.hash(code),
        bookingId,
        guestId: booking.primaryGuestId,
        destination,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    return { devCode: this.devReveal(code, destination) };
  }

  async verifyBookingOtp(bookingId: string, code: string): Promise<void> {
    await this.consume({ purpose: OtpPurpose.BOOKING_ACTION, bookingId }, code, () => undefined);
  }

  private async consume<T>(
    where: Prisma.OtpCodeWhereInput,
    code: string,
    onSuccess: () => T,
  ): Promise<T> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { ...where, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Invalid or expired code');
    if (otp.attempts >= otp.maxAttempts) throw new BadRequestException('Too many attempts');

    if (otp.codeHash !== this.hash(code)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return onSuccess();
  }
}

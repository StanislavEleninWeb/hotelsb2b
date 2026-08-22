import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Channel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth-user';
import { AuthLockoutService } from './auth-lockout.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { RefreshContext, TokenService } from './token.service';

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly lockout: AuthLockoutService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async audit(action: string, actor: { userId?: string; guestId?: string }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: 'Auth',
        entityId: actor.userId ?? actor.guestId ?? 'unknown',
        action,
        channel: Channel.WEB,
        actorUserId: actor.userId ?? null,
        actorGuestId: actor.guestId ?? null,
      },
    });
  }

  async staffLogin(email: string, password: string, ctx: RefreshContext): Promise<AuthResult> {
    const id = `staff:${email.toLowerCase()}`;
    await this.lockout.assertNotLocked(id);
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.active || !(await this.passwords.verify(password, user.passwordHash))) {
      await this.lockout.recordFailure(id);
      await this.audit('login_failure', {});
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.lockout.clear(id);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const authUser: AuthUser = { kind: 'staff', id: user.id, email: user.email, role: user.role };
    await this.audit('staff_login', { userId: user.id });
    return this.issue(authUser, ctx);
  }

  async guestRegister(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    ctx: RefreshContext,
  ): Promise<AuthResult> {
    const normalized = email.toLowerCase();
    const existing = await this.prisma.guest.findFirst({
      where: { email: normalized, isAccount: true },
    });
    if (existing) throw new ConflictException('An account with this email already exists');
    const guest = await this.prisma.guest.create({
      data: {
        email: normalized,
        firstName,
        lastName,
        isAccount: true,
        passwordHash: await this.passwords.hash(password),
      },
    });
    await this.audit('guest_register', { guestId: guest.id });
    return this.issue({ kind: 'guest', id: guest.id, email: guest.email }, ctx);
  }

  async guestLogin(email: string, password: string, ctx: RefreshContext): Promise<AuthResult> {
    const id = `guest:${email.toLowerCase()}`;
    await this.lockout.assertNotLocked(id);
    const guest = await this.prisma.guest.findFirst({
      where: { email: email.toLowerCase(), isAccount: true },
    });
    if (!guest?.passwordHash || !(await this.passwords.verify(password, guest.passwordHash))) {
      await this.lockout.recordFailure(id);
      await this.audit('login_failure', {});
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.lockout.clear(id);
    await this.audit('guest_login', { guestId: guest.id });
    return this.issue({ kind: 'guest', id: guest.id, email: guest.email }, ctx);
  }

  async guestOtpRequest(email: string): Promise<{ devCode?: string }> {
    const id = `otp-login:${email.toLowerCase()}`;
    await this.lockout.assertNotLocked(id);
    return this.otp.issueLoginOtp(email.toLowerCase());
  }

  async guestOtpVerify(email: string, code: string, ctx: RefreshContext): Promise<AuthResult> {
    const id = `otp-login:${email.toLowerCase()}`;
    await this.lockout.assertNotLocked(id);
    try {
      const guestId = await this.otp.verifyLoginOtp(email.toLowerCase(), code);
      await this.lockout.clear(id);
      const guest = await this.prisma.guest.findUniqueOrThrow({ where: { id: guestId } });
      await this.audit('guest_otp_login', { guestId });
      return this.issue({ kind: 'guest', id: guest.id, email: guest.email }, ctx);
    } catch (err) {
      await this.lockout.recordFailure(id);
      throw err;
    }
  }

  async refresh(rawRefresh: string, ctx: RefreshContext): Promise<AuthResult> {
    const { subject, refresh } = await this.tokens.rotate(rawRefresh, ctx);
    const user = await this.loadAuthUser(subject);
    return { user, accessToken: this.tokens.issueAccessToken(user), refreshToken: refresh };
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (rawRefresh) await this.tokens.revokeByRaw(rawRefresh);
  }

  requestBookingOtp(bookingId: string): Promise<{ devCode?: string }> {
    return this.otp.issueBookingOtp(bookingId);
  }

  /** Short-lived signed token proving a booking-action OTP was verified (Phase 8). */
  async verifyBookingOtp(bookingId: string, code: string): Promise<{ verificationToken: string }> {
    await this.otp.verifyBookingOtp(bookingId, code);
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret';
    const verificationToken = this.jwt.sign(
      { bookingId, purpose: 'booking_action' },
      { secret, expiresIn: '15m' },
    );
    return { verificationToken };
  }

  private async issue(user: AuthUser, ctx: RefreshContext): Promise<AuthResult> {
    const refreshToken = await this.tokens.issueRefreshToken(
      { kind: user.kind, id: user.id },
      ctx,
    );
    return { user, accessToken: this.tokens.issueAccessToken(user), refreshToken };
  }

  private async loadAuthUser(
    subject: { kind: 'staff' | 'guest'; id: string },
  ): Promise<AuthUser> {
    if (subject.kind === 'staff') {
      const user = await this.prisma.user.findUnique({ where: { id: subject.id } });
      if (!user || !user.active) throw new UnauthorizedException('Account is inactive');
      return { kind: 'staff', id: user.id, email: user.email, role: user.role };
    }
    const guest = await this.prisma.guest.findUnique({ where: { id: subject.id } });
    if (!guest) throw new UnauthorizedException('Account not found');
    return { kind: 'guest', id: guest.id, email: guest.email };
  }
}

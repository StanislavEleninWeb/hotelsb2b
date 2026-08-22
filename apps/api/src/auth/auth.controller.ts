import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService, AuthResult } from './auth.service';
import { AuthMode } from './dto/auth.dto';
import {
  BookingOtpVerifyDto,
  GuestLoginDto,
  GuestRegisterDto,
  OtpRequestDto,
  OtpVerifyDto,
  StaffLoginDto,
} from './dto/auth.dto';
import { RefreshContext } from './token.service';
import { AuthUser } from './auth-user';
import { Authenticated, CurrentUser, JwtAuthGuard } from './decorators';

const ACCESS_MAX_AGE = 15 * 60 * 1000;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

// Aggressive limits on all auth endpoints (§5.5), on top of per-identifier lockout.
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: Request): RefreshContext {
    return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
  }

  // Sets cookies (cookie mode) or returns tokens (bearer mode), and returns the user.
  private respond(res: Response, result: AuthResult, mode: AuthMode = 'cookie'): unknown {
    if (mode === 'bearer') {
      return { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
    }
    const secure = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, secure, sameSite: 'lax' as const };
    res.cookie('access_token', result.accessToken, { ...base, path: '/', maxAge: ACCESS_MAX_AGE });
    res.cookie('refresh_token', result.refreshToken, {
      ...base,
      path: '/api/v1/auth',
      maxAge: REFRESH_MAX_AGE,
    });
    // Non-httpOnly CSRF token for the double-submit pattern (SameSite=Lax cookies).
    const csrf = randomBytes(24).toString('base64url');
    res.cookie('csrf_token', csrf, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
    return { user: result.user, csrfToken: csrf };
  }

  @Post('staff/login')
  async staffLogin(
    @Body() dto: StaffLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const result = await this.auth.staffLogin(dto.email, dto.password, this.ctx(req));
    return this.respond(res, result, dto.mode);
  }

  @Post('register')
  async register(
    @Body() dto: GuestRegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const result = await this.auth.guestRegister(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
      this.ctx(req),
    );
    return this.respond(res, result, dto.mode);
  }

  @Post('login')
  async guestLogin(
    @Body() dto: GuestLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const result = await this.auth.guestLogin(dto.email, dto.password, this.ctx(req));
    return this.respond(res, result, dto.mode);
  }

  @Post('otp/request')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  otpRequest(@Body() dto: OtpRequestDto): Promise<{ devCode?: string }> {
    return this.auth.guestOtpRequest(dto.email);
  }

  @Post('otp/verify')
  async otpVerify(
    @Body() dto: OtpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const result = await this.auth.guestOtpVerify(dto.email, dto.code, this.ctx(req));
    return this.respond(res, result, dto.mode);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string; mode?: AuthMode },
  ): Promise<unknown> {
    const raw = body?.refreshToken ?? req.cookies?.refresh_token;
    if (!raw) throw new UnauthorizedException('No refresh token');
    const result = await this.auth.refresh(raw, this.ctx(req));
    return this.respond(res, result, body?.refreshToken ? 'bearer' : 'cookie');
  }

  @Post('logout')
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ): Promise<{ ok: true }> {
    await this.auth.logout(body?.refreshToken ?? req.cookies?.refresh_token);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    res.clearCookie('csrf_token', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Authenticated()
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  // Booking-action identity verification (phone/AI). Public but heavily throttled;
  // the code is sent to the contact ON THE BOOKING, never a request-supplied one.
  @Post('bookings/:id/otp/request')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  bookingOtpRequest(@Param('id', ParseUUIDPipe) id: string): Promise<{ devCode?: string }> {
    return this.auth.requestBookingOtp(id);
  }

  @Post('bookings/:id/otp/verify')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  bookingOtpVerify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookingOtpVerifyDto,
  ): Promise<{ verificationToken: string }> {
    return this.auth.verifyBookingOtp(id, dto.code);
  }
}

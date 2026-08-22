import { Body, Controller, Get, Headers, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Booking } from '@prisma/client';
import { ActionContext, Ctx } from '../../common/action-context';
import { Audit } from '../../common/audit/audit.decorator';
import { AuditLogInterceptor } from '../../common/audit/audit-log.interceptor';
import { HmacSignatureGuard } from './hmac-signature.guard';
import { AiService } from './ai.service';
import { AI_TOOLS } from './tool-schemas';

const AI_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

// The AI assistant boundary (§4). Every state-changing op runs through the SAME
// service layer as web/staff (AI-08). Webhooks are HMAC-signed + replay-protected
// (HmacSignatureGuard). Booking disclosure/cancel require an OTP verification token
// (AI-03). All writes are audited with channel = ai_* (from X-Channel).
// Bodies are plain objects validated by shared Zod in AiService — this deliberately
// bypasses the global forbidNonWhitelisted pipe so provider envelope metadata is
// stripped, not rejected.
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  // Public: the tool JSON Schemas the ElevenLabs agent is configured with.
  @Get('tools')
  tools() {
    return AI_TOOLS;
  }

  @Post('availability')
  @UseGuards(HmacSignatureGuard)
  @Throttle(AI_THROTTLE)
  availability(@Body() body: unknown) {
    return this.ai.checkAvailability(body);
  }

  @Post('bookings')
  @UseGuards(HmacSignatureGuard)
  @Throttle(AI_THROTTLE)
  @UseInterceptors(AuditLogInterceptor)
  @Audit('Booking', 'create')
  createBooking(
    @Body() body: unknown,
    @Ctx() ctx: ActionContext,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<Booking> {
    return this.ai.createBooking(body, idempotencyKey, ctx);
  }

  @Post('otp/request')
  @UseGuards(HmacSignatureGuard)
  @Throttle(AI_THROTTLE)
  requestOtp(@Body() body: unknown) {
    return this.ai.requestOtp(body);
  }

  @Post('otp/verify')
  @UseGuards(HmacSignatureGuard)
  @Throttle(AI_THROTTLE)
  verifyOtp(@Body() body: unknown) {
    return this.ai.verifyOtp(body);
  }

  @Post('bookings/get')
  @UseGuards(HmacSignatureGuard)
  @Throttle(AI_THROTTLE)
  getBooking(@Body() body: unknown) {
    return this.ai.getBooking(body);
  }

  @Post('bookings/cancel')
  @UseGuards(HmacSignatureGuard)
  @Throttle(AI_THROTTLE)
  @UseInterceptors(AuditLogInterceptor)
  @Audit('Booking', 'cancel')
  cancelBooking(@Body() body: unknown): Promise<Booking> {
    return this.ai.cancelBooking(body);
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Booking, StaffRole } from '@prisma/client';
import { ActionContext, Ctx } from '../../common/action-context';
import { Audit } from '../../common/audit/audit.decorator';
import { AuditLogInterceptor } from '../../common/audit/audit-log.interceptor';
import { Roles } from '../../common/auth/roles.decorator';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LookupBookingDto } from './dto/booking-query.dto';
import { TransitionBookingDto } from './dto/transition-booking.dto';

@Controller('bookings')
@UseInterceptors(AuditLogInterceptor)
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // Public: guests can book without an account (BK-02).
  @Post()
  @Audit('Booking', 'create')
  create(
    @Body() dto: CreateBookingDto,
    @Ctx() ctx: ActionContext,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<Booking> {
    return this.idempotency.execute(idempotencyKey, () => this.bookings.create(dto, ctx));
  }

  // Public lookup by confirmation code + last name (MG-01). Tight rate limit.
  @Post('lookup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  lookup(@Body() dto: LookupBookingDto): Promise<Booking> {
    return this.bookings.lookup(dto.confirmationCode, dto.lastName);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Booking> {
    return this.bookings.findByIdOrThrow(id);
  }

  // Cancel is available to the booking holder flow; staff cancel goes through the
  // staff panel. Object-level authorization is enforced in Phase 4.
  @Post(':id/cancel')
  @Audit('Booking', 'cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<Booking> {
    return this.bookings.cancel(id, body?.reason);
  }

  // Staff-only guarded status transitions (confirm/check-in/check-out/no-show).
  @Post(':id/transition')
  @Roles(StaffRole.FRONT_DESK, StaffRole.MANAGER, StaffRole.ADMIN)
  @Audit('Booking', 'transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionBookingDto,
  ): Promise<Booking> {
    return this.bookings.transition(id, dto.to, dto.reason);
  }
}

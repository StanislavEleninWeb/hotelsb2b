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
import { PropertyScope } from '../../auth/guards/property-scope.guard';
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
    const fingerprint = IdempotencyService.fingerprint(['POST /bookings', dto]);
    return this.idempotency.execute(idempotencyKey, fingerprint, () =>
      this.bookings.create(dto, ctx),
    );
  }

  // Public lookup by confirmation code + last name (MG-01). Tight rate limit.
  @Post('lookup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  lookup(@Body() dto: LookupBookingDto): Promise<Booking> {
    return this.bookings.lookup(dto.confirmationCode, dto.lastName);
  }

  // Object-level authorization (BOLA, §5.6): the owning guest OR staff scoped to
  // the booking's property. PropertyScopeGuard 401s anonymous, 403s out-of-scope
  // staff, 404s a guest asking for someone else's booking.
  @Get(':id')
  @PropertyScope('booking', 'id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Booking> {
    return this.bookings.findByIdOrThrow(id);
  }

  // Cancel — owning guest or property-scoped staff (same BOLA rule).
  @Post(':id/cancel')
  @PropertyScope('booking', 'id')
  @Audit('Booking', 'cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<Booking> {
    return this.bookings.cancel(id, body?.reason);
  }

  // Staff-only lifecycle transitions (confirm/check-in/check-out/no-show), scoped
  // to the booking's property.
  @Post(':id/transition')
  @Roles(StaffRole.FRONT_DESK, StaffRole.MANAGER, StaffRole.ADMIN)
  @PropertyScope('booking', 'id')
  @Audit('Booking', 'transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionBookingDto,
  ): Promise<Booking> {
    return this.bookings.transition(id, dto.to, dto.reason);
  }
}

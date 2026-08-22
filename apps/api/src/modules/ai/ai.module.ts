import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingsModule } from '../bookings/bookings.module';
import { AuthModule } from '../../auth/auth.module';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { HmacSignatureGuard } from './hmac-signature.guard';

@Module({
  imports: [AvailabilityModule, BookingsModule, AuthModule],
  controllers: [AiController],
  providers: [AiService, IdempotencyService, HmacSignatureGuard],
})
export class AiModule {}

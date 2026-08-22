import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AvailabilityModule],
  controllers: [BookingsController],
  providers: [BookingsService, IdempotencyService],
  exports: [BookingsService],
})
export class BookingsModule {}

import { Module, Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DevicesModule } from '../devices/devices.module';
import { NotificationsService, NOTIFICATIONS_QUEUE } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';

// Skip the live BullMQ worker under test so the suite doesn't hold a worker
// connection open (the queue itself is still registered for enqueue).
const workerProviders: Provider[] =
  process.env.NODE_ENV === 'test' ? [] : [NotificationsProcessor];

@Module({
  imports: [DevicesModule, BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [NotificationsService, ...workerProviders],
  exports: [NotificationsService],
})
export class NotificationsModule {}

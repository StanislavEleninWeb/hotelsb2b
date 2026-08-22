import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsService, NOTIFICATIONS_QUEUE } from './notifications.service';

// BullMQ worker. Registered only outside tests (see NotificationsModule) so the
// suite doesn't spawn a live worker connection.
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    await this.notifications.process(job.data.notificationId);
  }
}

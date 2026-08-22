import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const NOTIFICATIONS_QUEUE = 'notifications';

/**
 * Async notification pipeline. The Notification ROW is the source of truth
 * (written inside the booking transaction, status PENDING); the BullMQ queue is
 * an optimization for fast processing, and `sweepPending` catches any row whose
 * enqueue was lost (process crash between commit and enqueue).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  /** Create PENDING notification rows for a booking event — call INSIDE the tx. */
  createForBooking(
    tx: Prisma.TransactionClient,
    booking: { id: string; propertyId: string },
    type: NotificationType,
    toAddress: string | null,
  ) {
    return tx.notification.create({
      data: {
        bookingId: booking.id,
        propertyId: booking.propertyId,
        type,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        toAddress,
      },
    });
  }

  /** Best-effort enqueue after commit. If it fails, the sweeper still delivers. */
  async enqueue(notificationId: string): Promise<void> {
    try {
      await this.queue.add('deliver', { notificationId }, { attempts: 3, removeOnComplete: true });
    } catch (err) {
      this.logger.warn(`enqueue failed for ${notificationId}; sweeper will retry: ${String(err)}`);
    }
  }

  /** Deliver one notification (stub: real email/SMS/push arrives with the provider). */
  async process(notificationId: string): Promise<void> {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.status === NotificationStatus.SENT) return;
    // Stub delivery. Phase 9 subscribes mobile push to the same event types.
    this.logger.log(`[notify] ${n.type} → ${n.channel} ${n.toAddress ?? '(no address)'}`);
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  }

  /** Catch stragglers: PENDING rows older than the grace window. */
  async sweepPending(olderThanMs = 30_000): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: { status: NotificationStatus.PENDING, createdAt: { lt: new Date(Date.now() - olderThanMs) } },
      select: { id: true },
      take: 100,
    });
    for (const r of rows) await this.process(r.id);
    return rows.length;
  }
}

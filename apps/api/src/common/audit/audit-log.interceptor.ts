import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { contextFromRequest } from '../action-context';
import { AUDIT_META, AuditMeta } from './audit.decorator';

// Records an append-only AuditLog row after any write endpoint marked with @Audit
// succeeds (ST-17, §5.10). Tagged with actor + channel from the request context.
// NOTE: runs after the handler's own transaction commits, so audit is not atomic
// with the write; a failed audit is logged, never surfaced to the client.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_META, context.getHandler());
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const ctx = contextFromRequest(req);

    return next.handle().pipe(
      tap((result) => {
        void this.record(meta, ctx, result);
      }),
    );
  }

  private async record(
    meta: AuditMeta,
    ctx: ReturnType<typeof contextFromRequest>,
    result: unknown,
  ): Promise<void> {
    try {
      const entity = (result ?? {}) as { id?: string; propertyId?: string };
      await this.prisma.auditLog.create({
        data: {
          entityType: meta.entityType,
          entityId: entity.id ?? 'unknown',
          action: meta.action,
          channel: ctx.channel,
          actorUserId: ctx.actorUserId ?? null,
          actorGuestId: ctx.actorGuestId ?? null,
          propertyId: entity.propertyId ?? null,
          after: result === undefined ? undefined : (result as object),
          correlationId: ctx.correlationId ?? null,
          ipAddress: ctx.ipAddress ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${meta.entityType}.${meta.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

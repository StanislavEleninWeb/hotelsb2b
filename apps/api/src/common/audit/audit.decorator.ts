import { SetMetadata } from '@nestjs/common';

export const AUDIT_META = 'audit:meta';

export interface AuditMeta {
  entityType: string; // e.g. "Booking"
  action: string; // e.g. "create", "cancel"
}

/** Mark a write endpoint for the AuditLogInterceptor. */
export const Audit = (entityType: string, action: string) =>
  SetMetadata(AUDIT_META, { entityType, action } satisfies AuditMeta);

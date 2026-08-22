import { SetMetadata } from '@nestjs/common';
import { StaffRole } from '@prisma/client';

export const ROLES_META = 'auth:roles';

/**
 * Restrict an endpoint to the given staff roles (function-level authz / BFLA,
 * §5.6). Endpoints with no @Roles are public reads. The RolesGuard reads
 * req.user, which the JWT auth layer (Phase 4) populates.
 */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_META, roles);

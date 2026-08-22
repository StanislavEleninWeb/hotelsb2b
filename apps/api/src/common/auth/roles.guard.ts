import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffRole } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_META } from './roles.decorator';

interface AuthedUser {
  id: string;
  role: StaffRole;
}

/**
 * Function-level authorization. Endpoints with no @Roles are public. Endpoints
 * with @Roles require an authenticated staff user (populated by the Phase 4 JWT
 * guard) whose role is in the allowed set — otherwise 403. Fails closed: no user
 * on a protected endpoint is denied, never allowed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_META, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // public read

    const req = context.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Authentication required');
    // ADMIN is a super-role that satisfies any function-level requirement.
    if (user.role === StaffRole.ADMIN || required.includes(user.role)) return true;
    throw new ForbiddenException('Insufficient role');
  }
}

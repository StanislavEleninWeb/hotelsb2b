import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth-user';

export type ScopedResource = 'booking' | 'property' | 'room' | 'ratePlan' | 'bookingRoom' | 'guest';

export const PROPERTY_SCOPE_META = 'auth:propertyScope';
export interface PropertyScopeMeta {
  resource: ScopedResource;
  param: string;
  source: 'param' | 'body';
}

/**
 * Enforce object-level authorization (BOLA, §5.6) on a route: the authenticated
 * subject must be allowed to act on the SPECIFIC resource named by `param`.
 * `@PropertyScope('booking', 'id')` → load that booking, then:
 *   - staff: allowed if ADMIN or they have StaffPropertyAccess for its property (else 403)
 *   - guest: allowed only for their OWN booking (else 404 — don't leak existence)
 * Use `source: 'body'` for create endpoints where the id is in the request body
 * (e.g. `@PropertyScope('property', 'propertyId', 'body')`).
 */
export const PropertyScope = (
  resource: ScopedResource,
  param = 'id',
  source: 'param' | 'body' = 'param',
) => SetMetadata(PROPERTY_SCOPE_META, { resource, param, source } satisfies PropertyScopeMeta);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PropertyScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<PropertyScopeMeta | undefined>(
      PROPERTY_SCOPE_META,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException('Authentication required');

    // Guards run before pipes, so validate the id ourselves (avoid a DB 500 on junk).
    const rawParam =
      meta.source === 'body'
        ? (req.body as Record<string, unknown> | undefined)?.[meta.param]
        : req.params[meta.param];
    const id = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      throw new BadRequestException(`Invalid ${meta.param}`);
    }

    const target = await this.resolve(meta.resource, id);
    if (!target) throw new NotFoundException(`${meta.resource} not found`);

    if (user.kind === 'guest') {
      // Guests may only act on their own booking; no access to inventory resources.
      if (meta.resource !== 'booking' || target.ownerGuestId !== user.id) {
        throw new NotFoundException(`${meta.resource} not found`);
      }
      return true;
    }

    // Staff: ADMIN is global; others need explicit property access.
    if (user.role === StaffRole.ADMIN) return true;
    const access = await this.prisma.staffPropertyAccess.findUnique({
      where: { userId_propertyId: { userId: user.id, propertyId: target.propertyId } },
    });
    if (!access) {
      throw new ForbiddenException('Not authorized for this property');
    }
    return true;
  }

  private async resolve(
    resource: ScopedResource,
    id: string,
  ): Promise<{ propertyId: string; ownerGuestId?: string } | null> {
    switch (resource) {
      case 'property': {
        const p = await this.prisma.property.findUnique({ where: { id }, select: { id: true } });
        return p ? { propertyId: p.id } : null;
      }
      case 'booking': {
        const b = await this.prisma.booking.findUnique({
          where: { id },
          select: { propertyId: true, primaryGuestId: true },
        });
        return b ? { propertyId: b.propertyId, ownerGuestId: b.primaryGuestId } : null;
      }
      case 'room': {
        const r = await this.prisma.room.findUnique({
          where: { id },
          select: { propertyId: true },
        });
        return r ? { propertyId: r.propertyId } : null;
      }
      case 'ratePlan': {
        const rp = await this.prisma.ratePlan.findUnique({
          where: { id },
          select: { propertyId: true },
        });
        return rp ? { propertyId: rp.propertyId } : null;
      }
      case 'bookingRoom': {
        const br = await this.prisma.bookingRoom.findUnique({
          where: { id },
          select: { propertyId: true },
        });
        return br ? { propertyId: br.propertyId } : null;
      }
      case 'guest': {
        // Guests aren't property-scoped; guest endpoints filter by the caller's
        // accessible properties in the service. This branch shouldn't be reached.
        return null;
      }
    }
  }
}

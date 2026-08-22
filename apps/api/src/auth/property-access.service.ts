import { Injectable } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth-user';

// 'ALL' = unrestricted (ADMIN). Otherwise the explicit set of property ids the
// staff user may see. Used for subject-driven filtering where a resource isn't
// itself property-scoped (e.g. a guest profile whose bookings span properties).
export type PropertyScopeSet = 'ALL' | string[];

@Injectable()
export class PropertyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async accessibleProperties(user: AuthUser): Promise<PropertyScopeSet> {
    if (user.kind !== 'staff') return [];
    if (user.role === StaffRole.ADMIN) return 'ALL';
    const rows = await this.prisma.staffPropertyAccess.findMany({
      where: { userId: user.id },
      select: { propertyId: true },
    });
    return rows.map((r) => r.propertyId);
  }
}

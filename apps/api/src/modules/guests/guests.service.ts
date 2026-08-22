import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PropertyScopeSet } from '../../auth/property-access.service';

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ST-12 guest profile, filtered to what the caller may see. A guest's bookings
   * and notes span properties, so we filter by the caller's accessible property
   * set (ADMIN = unrestricted) — subject-driven, since Guest has no propertyId.
   */
  async getProfile(guestId: string, scope: PropertyScopeSet) {
    const guest = await this.prisma.guest.findUnique({
      where: { id: guestId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isAccount: true,
        marketingOptIn: true,
        createdAt: true,
      },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const propFilter = scope === 'ALL' ? {} : { propertyId: { in: scope } };
    const bookings = await this.prisma.booking.findMany({
      where: { primaryGuestId: guestId, ...propFilter },
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { name: true } } },
    });
    const notes = await this.prisma.guestNote.findMany({
      where:
        scope === 'ALL'
          ? { guestId }
          : { guestId, OR: [{ propertyId: { in: scope } }, { propertyId: null }] },
      orderBy: { createdAt: 'desc' },
    });

    return { guest, bookings, notes };
  }

  async addNote(guestId: string, propertyId: string, authorUserId: string, body: string) {
    await this.prisma.guest.findUniqueOrThrow({ where: { id: guestId } });
    return this.prisma.guestNote.create({
      data: { guestId, propertyId, authorUserId, body },
    });
  }
}

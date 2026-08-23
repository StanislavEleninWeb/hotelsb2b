import { Injectable } from '@nestjs/common';
import { DevicePlatform, DeviceToken } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../auth/auth-user';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  register(user: AuthUser, token: string, platform: DevicePlatform): Promise<DeviceToken> {
    const owner = {
      userId: user.kind === 'staff' ? user.id : null,
      guestId: user.kind === 'guest' ? user.id : null,
    };
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { ...owner, platform },
      create: { token, platform, ...owner },
    });
  }

  // Scope deletion to the caller's own tokens (BOLA — a user must not unregister
  // another user's device by guessing its token value).
  async unregister(user: AuthUser, token: string): Promise<void> {
    const owner =
      user.kind === 'staff' ? { userId: user.id } : { guestId: user.id };
    await this.prisma.deviceToken.deleteMany({ where: { token, ...owner } });
  }

  tokensForGuest(guestId: string): Promise<DeviceToken[]> {
    return this.prisma.deviceToken.findMany({ where: { guestId } });
  }
}

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

  async unregister(token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  tokensForGuest(guestId: string): Promise<DeviceToken[]> {
    return this.prisma.deviceToken.findMany({ where: { guestId } });
  }
}

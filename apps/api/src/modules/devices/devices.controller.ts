import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { DevicePlatform } from '@prisma/client';
import { CurrentUser, JwtAuthGuard } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { DevicesService } from './devices.service';

class RegisterDeviceDto {
  @IsString()
  @MaxLength(512)
  token!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}

// Push-token registration (Phase 9). An AUTHENTICATED guest/staff action keyed to
// req.user — deliberately NOT under the HMAC-guarded /ai module.
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post('register')
  register(@Body() dto: RegisterDeviceDto, @CurrentUser() user: AuthUser) {
    return this.devices.register(user, dto.token, dto.platform);
  }

  @Delete(':token')
  async unregister(
    @Param('token') token: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    await this.devices.unregister(user, token);
    return { ok: true };
  }
}

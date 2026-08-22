import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Room, StaffRole } from '@prisma/client';
import { Audit } from '../../common/audit/audit.decorator';
import { AuditLogInterceptor } from '../../common/audit/audit-log.interceptor';
import { Roles } from '../../common/auth/roles.decorator';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

// Physical-room inventory is staff-only (never exposed to guests).
@Controller('rooms')
@UseInterceptors(AuditLogInterceptor)
@Roles(StaffRole.FRONT_DESK, StaffRole.MANAGER, StaffRole.HOUSEKEEPING, StaffRole.ADMIN)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Query('propertyId', ParseUUIDPipe) propertyId: string): Promise<Room[]> {
    return this.rooms.listByProperty(propertyId);
  }

  @Post()
  @Roles(StaffRole.MANAGER, StaffRole.ADMIN)
  @Audit('Room', 'create')
  create(@Body() dto: CreateRoomDto): Promise<Room> {
    return this.rooms.create(dto);
  }

  @Patch(':id')
  @Audit('Room', 'update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto): Promise<Room> {
    return this.rooms.update(id, dto);
  }
}

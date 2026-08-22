import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Room, RoomBlock, StaffRole } from '@prisma/client';
import { Audit } from '../../common/audit/audit.decorator';
import { AuditLogInterceptor } from '../../common/audit/audit-log.interceptor';
import { Roles } from '../../common/auth/roles.decorator';
import { PropertyScope } from '../../auth/guards/property-scope.guard';
import { CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { RoomsService } from './rooms.service';
import { BlockRoomDto, CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

// Physical-room inventory is staff-only AND property-scoped (BOLA). Every route
// resolves the property from its target resource — a front-desk user at property A
// cannot touch property B's rooms even with a valid token.
@Controller('rooms')
@UseInterceptors(AuditLogInterceptor)
@Roles(StaffRole.FRONT_DESK, StaffRole.MANAGER, StaffRole.HOUSEKEEPING, StaffRole.ADMIN)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('by-property/:propertyId')
  @PropertyScope('property', 'propertyId')
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string): Promise<Room[]> {
    return this.rooms.listByProperty(propertyId);
  }

  @Get('by-property/:propertyId/blocks')
  @PropertyScope('property', 'propertyId')
  blocks(@Param('propertyId', ParseUUIDPipe) propertyId: string): Promise<RoomBlock[]> {
    return this.rooms.listBlocks(propertyId);
  }

  @Post()
  @Roles(StaffRole.MANAGER, StaffRole.ADMIN)
  @PropertyScope('property', 'propertyId', 'body')
  @Audit('Room', 'create')
  create(@Body() dto: CreateRoomDto): Promise<Room> {
    return this.rooms.create(dto);
  }

  @Patch(':id')
  @PropertyScope('room', 'id')
  @Audit('Room', 'update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto): Promise<Room> {
    return this.rooms.update(id, dto);
  }

  @Post(':id/block')
  @Roles(StaffRole.FRONT_DESK, StaffRole.MANAGER, StaffRole.ADMIN)
  @PropertyScope('room', 'id')
  @Audit('RoomBlock', 'create')
  block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockRoomDto,
    @CurrentUser() user: AuthUser,
  ): Promise<RoomBlock> {
    return this.rooms.block(id, { ...dto, userId: user.kind === 'staff' ? user.id : undefined });
  }
}

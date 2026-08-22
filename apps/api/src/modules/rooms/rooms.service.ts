import { Injectable, NotFoundException } from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  listByProperty(propertyId: string): Promise<Room[]> {
    return this.prisma.room.findMany({ where: { propertyId }, orderBy: { number: 'asc' } });
  }

  create(dto: CreateRoomDto): Promise<Room> {
    return this.prisma.room.create({ data: dto });
  }

  async update(id: string, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    return this.prisma.room.update({ where: { id }, data: dto });
  }
}

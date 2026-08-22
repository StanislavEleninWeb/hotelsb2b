import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Room, RoomBlock } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  listByProperty(propertyId: string): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: { propertyId },
      orderBy: { number: 'asc' },
      include: { roomType: { select: { name: true } } },
    });
  }

  async create(dto: CreateRoomDto): Promise<Room> {
    const room = await this.prisma.room.create({ data: dto });
    await this.cache.bumpProperty(dto.propertyId); // new inventory affects availability
    return room;
  }

  async update(id: string, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    const updated = await this.prisma.room.update({ where: { id }, data: dto });
    // status (OUT_OF_SERVICE) / active changes affect availability.
    await this.cache.bumpProperty(room.propertyId);
    return updated;
  }

  listBlocks(propertyId: string): Promise<RoomBlock[]> {
    return this.prisma.roomBlock.findMany({
      where: { propertyId },
      orderBy: { startDate: 'asc' },
    });
  }

  // Block a room (ST-04). Refuses if an active booking overlaps the block window.
  async block(
    roomId: string,
    input: { startDate: string; endDate: string; reason: string; userId?: string },
  ): Promise<RoomBlock> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    if (end <= start) throw new BadRequestException('endDate must be after startDate');

    const clash = await this.prisma.bookingRoom.findFirst({
      where: {
        roomId,
        checkIn: { lt: end },
        checkOut: { gt: start },
        booking: { status: { in: ACTIVE_STATUSES } },
      },
    });
    if (clash) throw new ConflictException('An active booking overlaps this block window');

    const block = await this.prisma.roomBlock.create({
      data: {
        propertyId: room.propertyId,
        roomId,
        startDate: start,
        endDate: end,
        reason: input.reason,
        createdByUserId: input.userId ?? null,
      },
    });
    await this.cache.bumpProperty(room.propertyId); // a block removes availability
    return block;
  }
}

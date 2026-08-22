import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RatePlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { CreateRatePlanDto, UpdateRatePlanDto } from './dto/rate-plan.dto';

@Injectable()
export class RatePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Staff: all rate plans for a property (with room-type name), for management. */
  listByProperty(propertyId: string): Promise<RatePlan[]> {
    return this.prisma.ratePlan.findMany({
      where: { propertyId },
      orderBy: [{ roomTypeId: 'asc' }, { basePriceMinor: 'asc' }],
      include: { roomType: { select: { name: true } } },
    });
  }

  /** Public: active rate plans for a room type. */
  findPublishedByRoomType(roomTypeId: string): Promise<RatePlan[]> {
    return this.prisma.ratePlan.findMany({
      where: { roomTypeId, active: true },
      orderBy: { basePriceMinor: 'asc' },
    });
  }

  async create(dto: CreateRatePlanDto): Promise<RatePlan> {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId: dto.propertyId },
    });
    if (!roomType) throw new BadRequestException('Room type does not belong to the property');
    const created = await this.prisma.ratePlan.create({
      data: { ...dto, currency: dto.currency.toUpperCase() },
    });
    await this.cache.bumpProperty(dto.propertyId);
    return created;
  }

  async update(id: string, dto: UpdateRatePlanDto): Promise<RatePlan> {
    const ratePlan = await this.prisma.ratePlan.findUnique({ where: { id } });
    if (!ratePlan) throw new NotFoundException('Rate plan not found');
    const updated = await this.prisma.ratePlan.update({ where: { id }, data: dto });
    // price / active changes affect cached search prices.
    await this.cache.bumpProperty(ratePlan.propertyId);
    return updated;
  }
}

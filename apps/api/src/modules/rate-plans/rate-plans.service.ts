import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RatePlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRatePlanDto, UpdateRatePlanDto } from './dto/rate-plan.dto';

@Injectable()
export class RatePlansService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.ratePlan.create({
      data: { ...dto, currency: dto.currency.toUpperCase() },
    });
  }

  async update(id: string, dto: UpdateRatePlanDto): Promise<RatePlan> {
    const ratePlan = await this.prisma.ratePlan.findUnique({ where: { id } });
    if (!ratePlan) throw new NotFoundException('Rate plan not found');
    return this.prisma.ratePlan.update({ where: { id }, data: dto });
  }
}

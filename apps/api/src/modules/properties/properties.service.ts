import { Injectable, NotFoundException } from '@nestjs/common';
import { Property } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: only active (published) properties. */
  findPublished(): Promise<Property[]> {
    return this.prisma.property.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async findPublishedOne(id: string): Promise<Property> {
    const property = await this.prisma.property.findFirst({ where: { id, active: true } });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  create(dto: CreatePropertyDto): Promise<Property> {
    return this.prisma.property.create({ data: { ...dto, currency: dto.currency.toUpperCase() } });
  }

  async update(id: string, dto: UpdatePropertyDto): Promise<Property> {
    await this.getOrThrow(id);
    return this.prisma.property.update({
      where: { id },
      data: { ...dto, ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}) },
    });
  }

  private async getOrThrow(id: string): Promise<Property> {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }
}

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
import { Property, StaffRole } from '@prisma/client';
import { Audit } from '../../common/audit/audit.decorator';
import { AuditLogInterceptor } from '../../common/audit/audit-log.interceptor';
import { Roles } from '../../common/auth/roles.decorator';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';

@Controller('properties')
@UseInterceptors(AuditLogInterceptor)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(): Promise<Property[]> {
    return this.properties.findPublished();
  }

  // SEO route — indexable by slug (SD-08). Declared before :id so it isn't shadowed.
  @Get('by-slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.properties.findPublishedBySlug(slug);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Property> {
    return this.properties.findPublishedOne(id);
  }

  @Post()
  @Roles(StaffRole.ADMIN, StaffRole.MANAGER)
  @Audit('Property', 'create')
  create(@Body() dto: CreatePropertyDto): Promise<Property> {
    return this.properties.create(dto);
  }

  @Patch(':id')
  @Roles(StaffRole.ADMIN, StaffRole.MANAGER)
  @Audit('Property', 'update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<Property> {
    return this.properties.update(id, dto);
  }
}

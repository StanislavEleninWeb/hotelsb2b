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
import { RatePlan, StaffRole } from '@prisma/client';
import { Audit } from '../../common/audit/audit.decorator';
import { AuditLogInterceptor } from '../../common/audit/audit-log.interceptor';
import { Roles } from '../../common/auth/roles.decorator';
import { PropertyScope } from '../../auth/guards/property-scope.guard';
import { RatePlansService } from './rate-plans.service';
import { CreateRatePlanDto, UpdateRatePlanDto } from './dto/rate-plan.dto';

@Controller('rate-plans')
@UseInterceptors(AuditLogInterceptor)
export class RatePlansController {
  constructor(private readonly ratePlans: RatePlansService) {}

  @Get()
  list(@Query('roomTypeId', ParseUUIDPipe) roomTypeId: string): Promise<RatePlan[]> {
    return this.ratePlans.findPublishedByRoomType(roomTypeId);
  }

  // Staff: all rate plans for a property (management view), property-scoped.
  @Get('by-property/:propertyId')
  @Roles(StaffRole.MANAGER, StaffRole.FINANCE, StaffRole.ADMIN)
  @PropertyScope('property', 'propertyId')
  listByProperty(@Param('propertyId', ParseUUIDPipe) propertyId: string): Promise<RatePlan[]> {
    return this.ratePlans.listByProperty(propertyId);
  }

  @Post()
  @Roles(StaffRole.MANAGER, StaffRole.ADMIN)
  @PropertyScope('property', 'propertyId', 'body')
  @Audit('RatePlan', 'create')
  create(@Body() dto: CreateRatePlanDto): Promise<RatePlan> {
    return this.ratePlans.create(dto);
  }

  @Patch(':id')
  @Roles(StaffRole.MANAGER, StaffRole.ADMIN)
  @PropertyScope('ratePlan', 'id')
  @Audit('RatePlan', 'update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRatePlanDto,
  ): Promise<RatePlan> {
    return this.ratePlans.update(id, dto);
  }
}

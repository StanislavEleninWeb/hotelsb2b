import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseInterceptors } from '@nestjs/common';
import { IsString, IsUUID, MaxLength } from 'class-validator';
import { StaffRole } from '@prisma/client';
import { Audit } from '../../common/audit/audit.decorator';
import { AuditLogInterceptor } from '../../common/audit/audit-log.interceptor';
import { Roles } from '../../common/auth/roles.decorator';
import { PropertyScope } from '../../auth/guards/property-scope.guard';
import { CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { PropertyAccessService } from '../../auth/property-access.service';
import { GuestsService } from './guests.service';

class AddNoteDto {
  @IsUUID()
  propertyId!: string;

  @IsString()
  @MaxLength(2000)
  body!: string;
}

// Staff-only guest profiles (ST-12). Not @PropertyScope — a guest isn't scoped to
// one property; the service filters by the caller's accessible properties.
@Controller('guests')
@UseInterceptors(AuditLogInterceptor)
@Roles(StaffRole.FRONT_DESK, StaffRole.MANAGER, StaffRole.FINANCE, StaffRole.ADMIN)
export class GuestsController {
  constructor(
    private readonly guests: GuestsService,
    private readonly access: PropertyAccessService,
  ) {}

  @Get(':id')
  async profile(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const scope = await this.access.accessibleProperties(user);
    return this.guests.getProfile(id, scope);
  }

  // The note's property must be one the author is scoped to (BOLA on the body field).
  @Post(':id/notes')
  @PropertyScope('property', 'propertyId', 'body')
  @Audit('GuestNote', 'create')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.guests.addNote(id, dto.propertyId, user.id, dto.body);
  }
}

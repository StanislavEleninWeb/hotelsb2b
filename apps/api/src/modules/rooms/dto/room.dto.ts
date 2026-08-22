import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RoomStatus } from '@prisma/client';

export class BlockRoomDto {
  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsString()
  @MaxLength(200)
  reason!: string;
}

export class CreateRoomDto {
  @IsUUID()
  propertyId!: string;

  @IsUUID()
  roomTypeId!: string;

  @IsString()
  @MaxLength(20)
  number!: string;

  @IsOptional()
  @IsInt()
  floor?: number;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  housekeepingNote?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

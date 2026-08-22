import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateBookingRoomDto {
  @IsUUID()
  roomTypeId!: string;

  @IsUUID()
  ratePlanId!: string;

  @IsInt()
  @Min(1)
  adults!: number;

  @IsInt()
  @Min(0)
  children!: number;
}

export class PrimaryGuestDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class CreateBookingDto {
  @IsUUID()
  propertyId!: string;

  @IsISO8601()
  checkIn!: string;

  @IsISO8601()
  checkOut!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingRoomDto)
  rooms!: CreateBookingRoomDto[];

  @ValidateNested()
  @Type(() => PrimaryGuestDto)
  primaryGuest!: PrimaryGuestDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}

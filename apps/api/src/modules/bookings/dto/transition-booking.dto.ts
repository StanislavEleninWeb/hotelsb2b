import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class TransitionBookingDto {
  @IsEnum(BookingStatus)
  to!: BookingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { CancellationPolicy, PaymentType } from '@prisma/client';

export class CreateRatePlanDto {
  @IsUUID()
  propertyId!: string;

  @IsUUID()
  roomTypeId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(CancellationPolicy)
  cancellationPolicy!: CancellationPolicy;

  @IsEnum(PaymentType)
  paymentType!: PaymentType;

  @IsOptional()
  @IsBoolean()
  includesBreakfast?: boolean;

  @IsInt()
  @Min(1)
  minStayNights!: number;

  @IsInt()
  @Min(0)
  basePriceMinor!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;
}

export class UpdateRatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  basePriceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minStayNights?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

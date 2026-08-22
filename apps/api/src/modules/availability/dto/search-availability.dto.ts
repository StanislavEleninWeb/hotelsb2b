import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsUUID, Max, Min } from 'class-validator';

export class SearchAvailabilityDto {
  @IsUUID()
  propertyId!: string;

  @IsISO8601()
  checkIn!: string;

  @IsISO8601()
  checkOut!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  adults = 1;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  children = 0;
}

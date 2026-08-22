import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string;

  @IsOptional()
  @IsISO8601()
  checkIn?: string;

  @IsOptional()
  @IsISO8601()
  checkOut?: string;

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

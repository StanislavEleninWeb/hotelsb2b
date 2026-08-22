import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be kebab-case' })
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsString()
  @MaxLength(64)
  timezone!: string;

  @IsString()
  @Length(3, 3, { message: 'currency must be a 3-letter ISO code' })
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;
}

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

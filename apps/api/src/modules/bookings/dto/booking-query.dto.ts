import { IsString, MaxLength } from 'class-validator';

// MG-01: retrieve a booking by confirmation code + last name (no account).
export class LookupBookingDto {
  @IsString()
  @MaxLength(20)
  confirmationCode!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;
}

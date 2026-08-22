import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export type AuthMode = 'cookie' | 'bearer';

class ModeMixin {
  // 'cookie' (default, web) sets httpOnly cookies; 'bearer' (mobile/API) returns
  // tokens in the response body.
  @IsOptional()
  @IsIn(['cookie', 'bearer'])
  mode?: AuthMode;
}

export class StaffLoginDto extends ModeMixin {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

export class GuestLoginDto extends ModeMixin {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

export class GuestRegisterDto extends ModeMixin {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password!: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;
}

export class OtpRequestDto {
  @IsEmail()
  email!: string;
}

export class OtpVerifyDto extends ModeMixin {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class BookingOtpVerifyDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

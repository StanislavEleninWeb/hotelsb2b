import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { AuthLockoutService } from './auth-lockout.service';
import { PropertyAccessService } from './property-access.service';
import { AuthContextGuard } from './guards/auth-context.guard';
import { PropertyScopeGuard } from './guards/property-scope.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './decorators';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    OtpService,
    AuthLockoutService,
    PropertyAccessService,
    AuthContextGuard,
    PropertyScopeGuard,
    CsrfGuard,
    JwtAuthGuard,
  ],
  exports: [TokenService, AuthService, PropertyAccessService],
})
export class AuthModule {}

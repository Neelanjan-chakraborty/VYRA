import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { DevOtpSender, OTP_SENDER } from './otp-sender.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    // Only the development sender exists so far; see docs/DECISIONS.md O-1.
    { provide: OTP_SENDER, useClass: DevOtpSender },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}

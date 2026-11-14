import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  type AuthTokens,
  type OtpRequestResponse,
  type OtpVerifyResponse,
  type RefreshRequest,
  type RegisterRequest,
} from '@vyra/validation';
import type { Request } from 'express';
import type { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';

function contextOf(request: Request) {
  return { requestId: getRequestId(request), userAgent: request.header('user-agent') };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a one-time code to an e-mail address or phone number' })
  requestOtp(
    @Body({ schema: otpRequestSchema }) body: z.output<typeof otpRequestSchema>,
  ): Promise<OtpRequestResponse> {
    return this.auth.requestOtp(body);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify a code: signs in, or returns a registration token' })
  verifyOtp(
    @Body({ schema: otpVerifySchema }) body: z.output<typeof otpVerifySchema>,
    @Req() request: Request,
  ): Promise<OtpVerifyResponse> {
    return this.auth.verifyOtp(body, contextOf(request));
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account after verification, with age and consent' })
  register(
    @Body({ schema: registerSchema }) body: RegisterRequest,
    @Req() request: Request,
  ): Promise<AuthTokens> {
    return this.auth.register(body, contextOf(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(
    @Body({ schema: refreshSchema }) body: RefreshRequest,
    @Req() request: Request,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken, contextOf(request));
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End the current session' })
  async logout(@CurrentUser() user: AuthContext): Promise<void> {
    await this.auth.logout(user.sessionId);
  }
}

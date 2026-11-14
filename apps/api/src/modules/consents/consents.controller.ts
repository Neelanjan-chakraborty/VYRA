import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  consentUpdateSchema,
  toggleableConsentSchema,
  type ConsentState,
  type ToggleableConsent,
} from '@vyra/validation';
import type { Request } from 'express';
import type { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { ConsentsService } from './consents.service.js';

@ApiTags('consents')
@ApiBearerAuth()
@Controller('me/consents')
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get()
  @ApiOperation({ summary: 'Optional consents and whether each is granted' })
  async list(@CurrentUser() user: AuthContext): Promise<{ consents: ConsentState[] }> {
    return { consents: await this.consents.list(user.userId) };
  }

  @Put(':type')
  @ApiOperation({ summary: 'Grant or withdraw an optional consent' })
  async set(
    @CurrentUser() user: AuthContext,
    @Param('type', { schema: toggleableConsentSchema }) type: ToggleableConsent,
    @Body({ schema: consentUpdateSchema }) body: z.infer<typeof consentUpdateSchema>,
    @Req() request: Request,
  ): Promise<{ consents: ConsentState[] }> {
    return {
      consents: await this.consents.set(user.userId, type, body.granted, getRequestId(request)),
    };
  }
}

import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { reportRequestSchema, type ReportRequest } from '@vyra/validation';
import type { Request } from 'express';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { ReportsService } from './reports.service.js';

@ApiTags('safety')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Report a person or one of their photos' })
  async create(
    @CurrentUser() user: AuthContext,
    @Body({ schema: reportRequestSchema }) body: ReportRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.reports.create(user.userId, body, getRequestId(request));
  }
}

import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FitResult, WeightSetView } from '@vyra/validation';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser, Roles } from '../auth/auth.decorators.js';
import { LearningService } from './learning.service.js';

const version = z.string().regex(/^[\w.-]{1,40}$/);

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/weights')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  @ApiOperation({ summary: 'Weight sets: active, approved, proposed and rejected, with metrics' })
  async list(): Promise<{ weightSets: WeightSetView[] }> {
    return { weightSets: await this.learning.list() };
  }

  @Post('fit')
  @ApiOperation({ summary: 'Learn a proposal from recent decisions now (normally weekly)' })
  fit(@CurrentUser() user: AuthContext, @Req() request: Request): Promise<FitResult> {
    return this.learning.fit(user.userId, getRequestId(request));
  }

  @Post(':version/approve')
  @ApiOperation({ summary: 'Make a proposed weight set the active one' })
  approve(
    @CurrentUser() user: AuthContext,
    @Param('version', { schema: version }) id: string,
    @Req() request: Request,
  ): Promise<WeightSetView> {
    return this.learning.approve(id, user.userId, getRequestId(request));
  }

  @Post(':version/reject')
  reject(
    @CurrentUser() user: AuthContext,
    @Param('version', { schema: version }) id: string,
    @Req() request: Request,
  ): Promise<WeightSetView> {
    return this.learning.reject(id, user.userId, getRequestId(request));
  }
}

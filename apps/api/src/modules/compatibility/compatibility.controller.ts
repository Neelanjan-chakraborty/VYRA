import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CompatibilityView, PublicProfile, RecommendationList } from '@vyra/validation';
import { z } from 'zod';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { CompatibilityService } from './compatibility.service.js';

const recommendationQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

@ApiTags('compatibility')
@ApiBearerAuth()
@Controller()
export class CompatibilityController {
  constructor(private readonly compatibility: CompatibilityService) {}

  @Get('compatibility/:userId')
  @ApiOperation({ summary: 'Estimated alignment with one person, with explanations and scenarios' })
  pair(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: z.uuid() }) userId: string,
  ): Promise<CompatibilityView> {
    return this.compatibility.forPair(user.userId, userId);
  }

  @Get('people/:userId')
  @ApiOperation({ summary: 'Another person’s profile preview. Only approved photos.' })
  profile(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: z.uuid() }) userId: string,
  ): Promise<PublicProfile> {
    return this.compatibility.profile(user.userId, userId);
  }

  @Get('discovery/recommendations')
  @ApiOperation({ summary: 'Ranked people the viewer may connect with, with reasons' })
  recommendations(
    @CurrentUser() user: AuthContext,
    @Query({ schema: recommendationQuery }) query: z.infer<typeof recommendationQuery>,
  ): Promise<RecommendationList> {
    return this.compatibility.recommendations(user.userId, query.limit);
  }
}

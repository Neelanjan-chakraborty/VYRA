import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type ResolvedPerson,
  searchQuerySchema,
  type SearchResults,
  USERNAME_MAX,
} from '@vyra/validation';
import { z } from 'zod';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { SearchService } from './search.service.js';

@ApiTags('search')
@ApiBearerAuth()
@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search/people')
  // Typing in a search box sends a request per pause; this still stops scraping.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Find people by username or name. Only people a profile view would also show.',
  })
  people(
    @CurrentUser() user: AuthContext,
    @Query({ schema: searchQuerySchema }) query: z.output<typeof searchQuerySchema>,
  ): Promise<SearchResults> {
    return this.search.search(user.userId, query.q, query.limit);
  }

  @Get('people/by-username/:username')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'The person behind a shared username, if you may see them' })
  resolve(
    @CurrentUser() user: AuthContext,
    @Param('username', {
      schema: z
        .string()
        .min(1)
        .max(USERNAME_MAX + 8),
    })
    username: string,
  ): Promise<ResolvedPerson> {
    return this.search.resolve(user.userId, username);
  }
}

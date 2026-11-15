import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Me, type UsernameCheck, usernameUpdateSchema } from '@vyra/validation';
import { z } from 'zod';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { UsernameService } from './username.service.js';

const checkQuery = z.object({ username: z.string().max(60) });

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class UsernameController {
  constructor(private readonly usernames: UsernameService) {}

  @Get('me/username/check')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Whether a username is valid and free (as you type)' })
  check(
    @CurrentUser() user: AuthContext,
    @Query({ schema: checkQuery }) query: z.output<typeof checkQuery>,
  ): Promise<UsernameCheck> {
    return this.usernames.check(user.userId, query.username);
  }

  @Put('me/username')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Choose or change your username (once every 14 days)' })
  set(
    @CurrentUser() user: AuthContext,
    @Body({ schema: usernameUpdateSchema }) body: z.output<typeof usernameUpdateSchema>,
  ): Promise<Me> {
    return this.usernames.set(user.userId, body.username);
  }
}

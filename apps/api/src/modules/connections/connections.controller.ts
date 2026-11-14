import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  connectionRequestCreateSchema,
  type Connections,
  type ConnectResult,
  type RelationshipState,
} from '@vyra/validation';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { ConnectionsService } from './connections.service.js';

const id = z.uuid();

@ApiTags('connections')
@ApiBearerAuth()
@Controller()
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get('connections')
  @ApiOperation({ summary: 'Incoming and sent requests, mutual connections and saved people' })
  list(@CurrentUser() user: AuthContext): Promise<Connections> {
    return this.connections.list(user.userId);
  }

  @Get('people/:userId/relationship')
  @ApiOperation({ summary: 'Where the viewer stands with one person' })
  relationship(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: id }) userId: string,
  ): Promise<RelationshipState> {
    return this.connections.relationship(user.userId, userId);
  }

  @Put('saved/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Save someone to come back to' })
  async save(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: id }) userId: string,
  ): Promise<void> {
    await this.connections.save(user.userId, userId);
  }

  @Delete('saved/:userId')
  @HttpCode(204)
  async unsave(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: id }) userId: string,
  ): Promise<void> {
    await this.connections.unsave(user.userId, userId);
  }

  @Post('discovery/pass/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Not now: hide from recommendations for 30 days' })
  async pass(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: id }) userId: string,
  ): Promise<void> {
    await this.connections.pass(user.userId, userId);
  }

  @Post('connections/requests')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ask to connect, with an optional note. Mutual interest connects at once',
  })
  connect(
    @CurrentUser() user: AuthContext,
    @Body({ schema: connectionRequestCreateSchema })
    body: z.output<typeof connectionRequestCreateSchema>,
    @Req() request: Request,
  ): Promise<ConnectResult> {
    return this.connections.connect(
      user.userId,
      body.recipientId,
      body.note,
      getRequestId(request),
    );
  }

  @Post('connections/requests/:id/accept')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) requestId: string,
    @Req() request: Request,
  ): Promise<{ matchId: string }> {
    return this.connections.accept(user.userId, requestId, getRequestId(request));
  }

  @Post('connections/requests/:id/decline')
  @HttpCode(204)
  async decline(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) requestId: string,
  ): Promise<void> {
    await this.connections.decline(user.userId, requestId);
  }

  @Post('connections/requests/:id/withdraw')
  @HttpCode(204)
  async withdraw(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) requestId: string,
  ): Promise<void> {
    await this.connections.withdraw(user.userId, requestId);
  }

  @Delete('connections/matches/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'End a mutual connection' })
  async endMatch(
    @CurrentUser() user: AuthContext,
    @Param('id', { schema: id }) matchId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.connections.endMatch(user.userId, matchId, getRequestId(request));
  }

  @Get('blocks')
  @ApiOperation({ summary: 'People you have blocked' })
  async blocked(
    @CurrentUser() user: AuthContext,
  ): Promise<{ blocked: { userId: string; displayName: string; blockedAt: string }[] }> {
    return { blocked: await this.connections.blocked(user.userId) };
  }

  @Post('blocks/:userId')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Block someone: ends everything between you and hides you from each other',
  })
  async block(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: id }) userId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.connections.block(user.userId, userId, getRequestId(request));
  }

  @Delete('blocks/:userId')
  @HttpCode(204)
  async unblock(
    @CurrentUser() user: AuthContext,
    @Param('userId', { schema: id }) userId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.connections.unblock(user.userId, userId, getRequestId(request));
  }
}

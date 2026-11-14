import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  assistantReflectionRequestSchema,
  personaEditSchema,
  type AssistantReflectionRequest,
  type AssistantReflectionResponse,
  type PersonaEdit,
  type PersonaView,
} from '@vyra/validation';
import type { Request } from 'express';
import { getRequestId } from '../../common/request-id.middleware.js';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';
import { PersonaService } from './persona.service.js';

@ApiTags('persona')
@ApiBearerAuth()
@Controller('me/persona')
export class PersonaController {
  constructor(private readonly persona: PersonaService) {}

  @Get()
  @ApiOperation({ summary: 'Approved persona, open draft and generation status' })
  get(@CurrentUser() user: AuthContext): Promise<PersonaView> {
    return this.persona.view(user.userId);
  }

  @Post('generate')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Draft a persona from your own profile (needs AI_PERSONA_PROCESSING consent)',
  })
  generate(@CurrentUser() user: AuthContext, @Req() request: Request): Promise<PersonaView> {
    return this.persona.requestGeneration(user.userId, getRequestId(request));
  }

  @Post('assistant-reflection')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Add answers pasted back from your own AI assistant to the draft' })
  reflection(
    @CurrentUser() user: AuthContext,
    @Body({ schema: assistantReflectionRequestSchema }) body: AssistantReflectionRequest,
    @Req() request: Request,
  ): Promise<AssistantReflectionResponse> {
    return this.persona.importAssistantReflection(
      user.userId,
      body.assistant,
      body.reply,
      getRequestId(request),
    );
  }

  @Patch('draft')
  @ApiOperation({ summary: 'Set, confirm or remove attributes in the draft' })
  edit(
    @CurrentUser() user: AuthContext,
    @Body({ schema: personaEditSchema }) body: PersonaEdit,
  ): Promise<PersonaView> {
    return this.persona.editDraft(user.userId, body);
  }

  @Post('draft/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve the draft; it replaces the current persona' })
  approve(@CurrentUser() user: AuthContext, @Req() request: Request): Promise<PersonaView> {
    return this.persona.approveDraft(user.userId, getRequestId(request));
  }

  @Delete('draft')
  @ApiOperation({ summary: 'Discard the draft' })
  discard(@CurrentUser() user: AuthContext): Promise<PersonaView> {
    return this.persona.discardDraft(user.userId);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete the persona and every version of it' })
  async clear(@CurrentUser() user: AuthContext, @Req() request: Request): Promise<void> {
    await this.persona.clear(user.userId, getRequestId(request));
  }
}

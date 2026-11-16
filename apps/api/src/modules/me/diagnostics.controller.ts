import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { clientEventSchema } from '@vyra/validation';
import type { z } from 'zod';
import { type AuthContext, CurrentUser } from '../auth/auth.decorators.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class DiagnosticsController {
  private readonly logger = new Logger('ClientEvent');

  @Post('me/client-events')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'The app reports a named problem it noticed on this device' })
  record(
    @CurrentUser() user: AuthContext,
    @Body({ schema: clientEventSchema }) body: z.output<typeof clientEventSchema>,
  ): void {
    // A fixed event name only: nothing the person typed, nothing from the device.
    this.logger.warn(`${body.event} user=${user.userId}`);
  }
}

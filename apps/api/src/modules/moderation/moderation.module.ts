import { Global, Module, type Provider } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationProcessor } from './moderation.processor.js';
import { ModerationService } from './moderation.service.js';
import { NsfwjsModerationProvider } from './nsfwjs-provider.js';
import {
  ManualModerationProvider,
  MockModerationProvider,
  PHOTO_MODERATION_PROVIDER,
} from './provider.js';

const workers: Provider[] = process.env.RUN_QUEUE_WORKERS === 'false' ? [] : [ModerationProcessor];

@Global()
@Module({
  controllers: [ModerationController],
  providers: [
    ModerationService,
    ...workers,
    {
      provide: PHOTO_MODERATION_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.PHOTO_MODERATION_PROVIDER === 'mock') return new MockModerationProvider();
        if (env.PHOTO_MODERATION_PROVIDER === 'manual') return new ManualModerationProvider();
        return new NsfwjsModerationProvider();
      },
    },
  ],
  exports: [ModerationService, PHOTO_MODERATION_PROVIDER],
})
export class ModerationModule {}

import { Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { CompatibilityModule } from '../compatibility/compatibility.module.js';
import { ConsentsModule } from '../consents/consents.module.js';
import { EphemeralService } from './ephemeral.service.js';
import { EphemeralProcessor, VideoProcessor } from './media-workers.processor.js';
import { MessageActionsService } from './message-actions.service.js';
import { MessageMediaService } from './message-media.service.js';
import { MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';
import { NotificationService } from './notification.service.js';
import { ExpoPushProvider, LogPushProvider, PUSH_PROVIDER } from './push-provider.js';
import { ScheduledMessageProcessor } from './scheduled-message.processor.js';
import { VaultService } from './vault.service.js';
import { WingmanService } from './wingman.service.js';

@Module({
  imports: [CompatibilityModule, ConsentsModule],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessageMediaService,
    MessageActionsService,
    ScheduledMessageProcessor,
    EphemeralService,
    EphemeralProcessor,
    VideoProcessor,
    VaultService,
    NotificationService,
    WingmanService,
    {
      provide: PUSH_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.PUSH_PROVIDER === 'expo' ? new ExpoPushProvider() : new LogPushProvider(),
    },
  ],
  exports: [MessagingService, NotificationService],
})
export class MessagingModule {}

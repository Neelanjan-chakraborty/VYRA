import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import type { ConnectionOptions } from 'bullmq';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

export const PERSONA_QUEUE = 'persona';
export const PHOTO_MODERATION_QUEUE = 'photo-moderation';
export const LEARNING_QUEUE = 'learning';
export const SCHEDULED_MESSAGES_QUEUE = 'scheduled-messages';
export const VIDEO_QUEUE = 'video';
export const EPHEMERAL_QUEUE = 'ephemeral';

/** BullMQ takes connection options rather than a URL. */
export function redisConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const db = Number(parsed.pathname.replace('/', '') || '0');
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    db: Number.isInteger(db) ? db : 0,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    // Required by BullMQ workers: commands wait for Redis instead of failing.
    maxRetriesPerRequest: null,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ENV],
      // Tests get their own prefix so a dev server's workers never take test jobs.
      useFactory: (env: Env) => ({
        connection: redisConnection(env.REDIS_URL),
        prefix: env.NODE_ENV === 'test' ? 'vyra-test' : 'vyra',
      }),
    }),
    BullModule.registerQueue(
      { name: PERSONA_QUEUE },
      { name: PHOTO_MODERATION_QUEUE },
      { name: LEARNING_QUEUE },
      { name: SCHEDULED_MESSAGES_QUEUE },
      { name: VIDEO_QUEUE },
      { name: EPHEMERAL_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}

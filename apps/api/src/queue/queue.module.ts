import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import type { ConnectionOptions } from 'bullmq';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

export const PERSONA_QUEUE = 'persona';

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
      useFactory: (env: Env) => ({ connection: redisConnection(env.REDIS_URL), prefix: 'vyra' }),
    }),
    BullModule.registerQueue({ name: PERSONA_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

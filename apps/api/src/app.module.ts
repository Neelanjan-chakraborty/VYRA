import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { createValidationPipe } from './common/validation.js';
import { ConfigModule, ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CompatibilityModule } from './modules/compatibility/compatibility.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ConsentsModule } from './modules/consents/consents.module.js';
import { LocationModule } from './modules/location/location.module.js';
import { MeModule } from './modules/me/me.module.js';
import { ModerationModule } from './modules/moderation/moderation.module.js';
import { PersonaModule } from './modules/persona/persona.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SafetyModule } from './modules/safety/safety.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    // Baseline per-IP limit; sensitive routes (OTP, uploads) add stricter limits.
    // Disabled under NODE_ENV=test, where every request comes from one address;
    // test/rate-limit.e2e-spec.ts turns it back on to prove the limits hold.
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        skipIf: () => env.NODE_ENV === 'test',
      }),
    }),
    QueueModule,
    AiModule,
    AuditModule,
    StorageModule,
    ModerationModule,
    AuthModule,
    HealthModule,
    LocationModule,
    MeModule,
    ConsentsModule,
    PersonaModule,
    CompatibilityModule,
    SafetyModule,
  ],
  providers: [
    // Order matters: rate limiting runs before authentication (AuthModule's guard).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*path');
  }
}

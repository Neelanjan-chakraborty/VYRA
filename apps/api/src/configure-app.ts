import { type INestApplication, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { RedisIoAdapter } from './modules/messaging/redis-io.adapter.js';

/**
 * HTTP-level setup shared by the real server and the end-to-end tests, so
 * tests exercise the same versioning, headers and CORS policy as production.
 */
export function configureApp(app: INestApplication, env: Env): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    credentials: true,
  });
  app.useWebSocketAdapter(new RedisIoAdapter(app, env));
  app.enableShutdownHooks();
}

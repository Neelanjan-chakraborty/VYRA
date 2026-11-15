import { type INestApplication, VersioningType } from '@nestjs/common';
import { constants } from 'node:zlib';
import compression from 'compression';
import helmet from 'helmet';
import type { Env } from './config/env.js';

/**
 * HTTP-level setup shared by the real server and the end-to-end tests, so
 * tests exercise the same versioning, headers and CORS policy as production.
 */
export function configureApp(app: INestApplication, env: Env): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(helmet());
  // brotli (or gzip) for JSON responses over 1 KB — message pages, lists and
  // profiles shrink several-fold. Media is already compressed and is skipped.
  app.use(
    compression({
      threshold: 1024,
      brotli: { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } },
      filter: (request, response) =>
        !String(response.getHeader('content-type') ?? '').startsWith('image/') &&
        !String(response.getHeader('content-type') ?? '').startsWith('audio/') &&
        compression.filter(request, response),
    }),
  );
  app.enableCors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    credentials: true,
  });
  app.enableShutdownHooks();
}

import 'dotenv/config';
import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const production = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    // Structured JSON logs in production; readable logs in development.
    logger: new ConsoleLogger({ json: production, colors: !production }),
  });
  const env = app.get<Env>(ENV);
  app.useLogger(
    new ConsoleLogger({ json: production, colors: !production, logLevels: [env.LOG_LEVEL] }),
  );
  configureApp(app, env);

  if (!production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('VYRA API')
        .setDescription('Chemistry, decoded.')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });
  }

  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`VYRA API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();

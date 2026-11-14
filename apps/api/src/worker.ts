import 'dotenv/config';
import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/** Runs the queue workers without serving HTTP. */
async function bootstrap(): Promise<void> {
  const production = process.env.NODE_ENV === 'production';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new ConsoleLogger({ json: production, colors: !production }),
  });
  app.enableShutdownHooks();
  new Logger('Worker').log('VYRA queue workers started');
}

await bootstrap();

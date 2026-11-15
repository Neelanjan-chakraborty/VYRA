import { Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { CompatibilityController } from './compatibility.controller.js';
import { CompatibilityService } from './compatibility.service.js';
import { createEngine, ENGINE } from './engine.js';
import { PeopleService } from './people.service.js';

@Module({
  controllers: [CompatibilityController],
  providers: [
    CompatibilityService,
    PeopleService,
    { provide: ENGINE, inject: [ENV], useFactory: (env: Env) => createEngine(env) },
  ],
  exports: [CompatibilityService, PeopleService, ENGINE],
})
export class CompatibilityModule {}

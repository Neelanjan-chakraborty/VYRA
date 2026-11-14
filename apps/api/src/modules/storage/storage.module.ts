import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { LocalObjectStorage } from './local-storage.js';
import { MediaController } from './media.controller.js';
import { MediaUrlService } from './media-url.service.js';
import { OBJECT_STORAGE } from './storage.js';

@Global()
@Module({
  controllers: [MediaController],
  providers: [
    MediaUrlService,
    {
      provide: OBJECT_STORAGE,
      inject: [ENV],
      // Only the local driver exists so far; see docs/DECISIONS.md O-2.
      useFactory: (env: Env) => new LocalObjectStorage(env.STORAGE_LOCAL_DIR),
    },
  ],
  exports: [OBJECT_STORAGE, MediaUrlService],
})
export class StorageModule {}

import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { PhotosService } from './photos.service.js';

@Module({
  controllers: [MeController],
  providers: [MeService, PhotosService],
})
export class MeModule {}

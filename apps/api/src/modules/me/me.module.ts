import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { PhotosService } from './photos.service.js';
import { UsernameController } from './username.controller.js';
import { UsernameService } from './username.service.js';

@Module({
  controllers: [MeController, UsernameController],
  providers: [MeService, PhotosService, UsernameService],
})
export class MeModule {}

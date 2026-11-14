import { Global, Module } from '@nestjs/common';
import { LocationController } from './location.controller.js';
import { LocationService } from './location.service.js';

@Global()
@Module({
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}

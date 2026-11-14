import { Module } from '@nestjs/common';
import { CompatibilityController } from './compatibility.controller.js';
import { CompatibilityService } from './compatibility.service.js';
import { PeopleService } from './people.service.js';

@Module({
  controllers: [CompatibilityController],
  providers: [CompatibilityService, PeopleService],
})
export class CompatibilityModule {}

import { Module } from '@nestjs/common';
import { CompatibilityModule } from '../compatibility/compatibility.module.js';
import { LandingController } from './landing.controller.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [CompatibilityModule],
  controllers: [SearchController, LandingController],
  providers: [SearchService],
})
export class SearchModule {}

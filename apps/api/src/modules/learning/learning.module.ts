import { Module, type Provider } from '@nestjs/common';
import { CompatibilityModule } from '../compatibility/compatibility.module.js';
import { LearningController } from './learning.controller.js';
import { LearningProcessor } from './learning.processor.js';
import { LearningService } from './learning.service.js';

const workers: Provider[] = process.env.RUN_QUEUE_WORKERS === 'false' ? [] : [LearningProcessor];

@Module({
  imports: [CompatibilityModule],
  controllers: [LearningController],
  providers: [LearningService, ...workers],
})
export class LearningModule {}

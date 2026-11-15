import { Processor, WorkerHost } from '@nestjs/bullmq';
import { LEARNING_QUEUE } from '../../queue/queue.module.js';
import { LearningService } from './learning.service.js';

/** The weekly fit. It only ever creates a proposal for an admin to review. */
@Processor(LEARNING_QUEUE, { concurrency: 1 })
export class LearningProcessor extends WorkerHost {
  constructor(private readonly learning: LearningService) {
    super();
  }

  async process(): Promise<void> {
    await this.learning.fit(null, null);
  }
}

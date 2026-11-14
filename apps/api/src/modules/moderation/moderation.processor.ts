import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PHOTO_MODERATION_QUEUE } from '../../queue/queue.module.js';
import { ModerationService } from './moderation.service.js';

/** One at a time: the classifier is CPU-bound. */
@Processor(PHOTO_MODERATION_QUEUE, { concurrency: 1 })
export class ModerationProcessor extends WorkerHost {
  constructor(private readonly moderation: ModerationService) {
    super();
  }

  async process(job: Job<{ photoId: string }>): Promise<void> {
    await this.moderation.assess(job.data.photoId);
  }
}

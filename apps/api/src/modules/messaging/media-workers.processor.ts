import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { EPHEMERAL_QUEUE, VIDEO_QUEUE } from '../../queue/queue.module.js';
import { type EphemeralJob, EphemeralService } from './ephemeral.service.js';
import { MessageMediaService, type VideoJob } from './message-media.service.js';

/** One video at a time: transcoding and the classifier are CPU-bound. */
@Processor(VIDEO_QUEUE, { concurrency: 1 })
export class VideoProcessor extends WorkerHost {
  constructor(private readonly media: MessageMediaService) {
    super();
  }

  async process(job: Job<VideoJob>): Promise<void> {
    await this.media.processVideo(job.data.messageId);
  }
}

/** The minute-by-minute sweeper and view-once deadlines. */
@Processor(EPHEMERAL_QUEUE, { concurrency: 1 })
export class EphemeralProcessor extends WorkerHost {
  constructor(private readonly ephemeral: EphemeralService) {
    super();
  }

  async process(job: Job<EphemeralJob>): Promise<void> {
    if (job.name === 'sweep') await this.ephemeral.sweep();
    else if (job.name === 'erase' && 'messageId' in job.data)
      await this.ephemeral.eraseViewOnce(job.data.messageId);
  }
}

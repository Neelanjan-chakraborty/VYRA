import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SCHEDULED_MESSAGES_QUEUE } from '../../queue/queue.module.js';
import { MessageActionsService, type ScheduledJob } from './message-actions.service.js';

/** Sends scheduled messages when their time comes. */
@Processor(SCHEDULED_MESSAGES_QUEUE, { concurrency: 4 })
export class ScheduledMessageProcessor extends WorkerHost {
  constructor(private readonly actions: MessageActionsService) {
    super();
  }

  async process(job: Job<ScheduledJob>): Promise<void> {
    await this.actions.deliver(job.data.scheduledId);
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PERSONA_QUEUE } from '../../queue/queue.module.js';
import { PersonaService } from './persona.service.js';

@Processor(PERSONA_QUEUE, { concurrency: 2 })
export class PersonaProcessor extends WorkerHost {
  constructor(private readonly persona: PersonaService) {
    super();
  }

  async process(job: Job<{ userId: string }>): Promise<void> {
    await this.persona.generate(job.data.userId);
  }
}

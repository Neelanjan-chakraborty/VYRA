import { Module, type Provider } from '@nestjs/common';
import { ConsentsModule } from '../consents/consents.module.js';
import { PersonaController } from './persona.controller.js';
import { PersonaProcessor } from './persona.processor.js';
import { PersonaService } from './persona.service.js';
import { SourceBundleService } from './source-bundle.js';

/**
 * Queue workers run inside the API by default. Set RUN_QUEUE_WORKERS=false on
 * API instances and run `node dist/worker.js` separately to split them.
 * Read at module load because Nest decides providers before config exists.
 */
const workers: Provider[] = process.env.RUN_QUEUE_WORKERS === 'false' ? [] : [PersonaProcessor];

@Module({
  imports: [ConsentsModule],
  controllers: [PersonaController],
  providers: [PersonaService, SourceBundleService, ...workers],
  exports: [PersonaService],
})
export class PersonaModule {}

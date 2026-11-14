import { Module } from '@nestjs/common';
import { CompatibilityModule } from '../compatibility/compatibility.module.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';

@Module({
  imports: [CompatibilityModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}

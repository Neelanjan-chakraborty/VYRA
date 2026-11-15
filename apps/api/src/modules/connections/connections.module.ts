import { Module } from '@nestjs/common';
import { CompatibilityModule } from '../compatibility/compatibility.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';

@Module({
  imports: [CompatibilityModule, MessagingModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}

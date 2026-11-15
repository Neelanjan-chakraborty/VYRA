import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import type { Env } from '../../config/env.js';

/** Socket path, versioned like the HTTP API. */
export const SOCKET_PATH = '/v1/socket';

/**
 * Socket.IO with the Redis adapter, so an event emitted by one API instance
 * reaches sockets connected to any other. CORS follows the HTTP allow-list.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly clients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly env: Env,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    // Nest's typing wants every option; socket.io fills in the defaults.
    const server = super.createIOServer(port, {
      ...options,
      path: SOCKET_PATH,
      serveClient: false,
      cors: {
        origin: this.env.CORS_ORIGINS.length > 0 ? this.env.CORS_ORIGINS : false,
        credentials: true,
      },
    } as ServerOptions) as Server;
    const pub = new Redis(this.env.REDIS_URL, { maxRetriesPerRequest: 2 });
    const sub = pub.duplicate();
    for (const client of [pub, sub]) {
      // Without a listener ioredis would crash the process on connection errors.
      client.on('error', () => undefined);
      this.clients.push(client);
    }
    server.adapter(createAdapter(pub, sub));
    return server;
  }

  override async dispose(): Promise<void> {
    await super.dispose();
    for (const client of this.clients) client.disconnect();
  }
}

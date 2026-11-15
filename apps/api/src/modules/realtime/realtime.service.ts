import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { RedisService } from '../../redis/redis.service.js';

/**
 * The API's side of real-time. App connections live in the Rust gateway
 * (crates/vyra-realtime); the API publishes events on Redis and every gateway
 * instance delivers them to its own sockets. Events carry ids and reasons,
 * never message text: the app fetches content over HTTP, where every read
 * passes the same authorisation checks.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly namespace: string;

  constructor(
    private readonly redis: RedisService,
    @Inject(ENV) env: Env,
  ) {
    // Same namespace rule as the gateway, so test runs never reach a dev gateway.
    this.namespace = env.NODE_ENV === 'test' ? 'vyra-test' : env.REALTIME_NAMESPACE;
  }

  private publish(envelope: object): void {
    this.redis.client
      .publish(`${this.namespace}:realtime`, JSON.stringify(envelope))
      .catch((error: Error) => this.logger.warn(`Realtime publish failed: ${error.message}`));
  }

  emit(userIds: readonly string[], event: string, payload: object): void {
    if (userIds.length > 0) this.publish({ userIds, event, payload });
  }

  /** True when the person has the app open on any gateway instance. */
  async isOnline(userId: string): Promise<boolean> {
    try {
      return Number(await this.redis.client.get(`${this.namespace}:presence:${userId}`)) > 0;
    } catch {
      return false;
    }
  }

  /** Closes every socket of these people (account deleted, suspended, signed out everywhere). */
  disconnectUsers(userIds: readonly string[]): void {
    if (userIds.length > 0) this.publish({ disconnect: userIds });
  }

  /** Closes the sockets opened with one session (one device signing out). */
  disconnectSession(sessionId: string): void {
    this.publish({ disconnectSessions: [sessionId] });
  }
}

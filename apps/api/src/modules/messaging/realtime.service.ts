import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export const userRoom = (userId: string): string => `u:${userId}`;

/**
 * The only way the rest of the API talks to connected apps. Events carry ids
 * and reasons, never message text: the app fetches content over HTTP, where
 * every read passes the same authorisation checks.
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  emit(userIds: readonly string[], event: string, payload: object): void {
    if (!this.server || userIds.length === 0) return;
    this.server.to(userIds.map(userRoom)).emit(event, payload);
  }

  /** True when the person has the app open somewhere (any API instance). */
  async isOnline(userId: string): Promise<boolean> {
    if (!this.server) return false;
    try {
      return (await this.server.in(userRoom(userId)).fetchSockets()).length > 0;
    } catch {
      return false;
    }
  }

  /** Closes every socket of a person, e.g. after sign-out or account deletion. */
  disconnect(userId: string): void {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }
}

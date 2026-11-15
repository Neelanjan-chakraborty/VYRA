import { Logger } from '@nestjs/common';

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

/** One notification to one device. Text is generic; never message content. */
export interface PushMessage {
  readonly token: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
}

export interface PushResult {
  /** Tokens the push service says are no longer valid; the caller forgets them. */
  readonly invalidTokens: readonly string[];
}

export interface PushProvider {
  readonly id: string;
  send(messages: readonly PushMessage[]): Promise<PushResult>;
}

/** Development and tests: remembers what would have been sent. Logs counts only. */
export class LogPushProvider implements PushProvider {
  readonly id = 'log';
  private readonly logger = new Logger('Push');
  readonly sent: PushMessage[] = [];

  async send(messages: readonly PushMessage[]): Promise<PushResult> {
    this.sent.push(...messages);
    this.logger.debug(`Would send ${messages.length} push notification(s)`);
    return { invalidTokens: [] };
  }
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Expo's push service (free, no credential for basic use). Unverified on real
 * devices in this repository: it needs a phone with a development build.
 */
export class ExpoPushProvider implements PushProvider {
  readonly id = 'expo';
  private readonly logger = new Logger('Push');

  async send(messages: readonly PushMessage[]): Promise<PushResult> {
    if (messages.length === 0) return { invalidTokens: [] };
    const invalidTokens: string[] = [];
    // Expo accepts up to 100 messages per request.
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(
            batch.map((m) => ({ to: m.token, title: m.title, body: m.body, data: m.data })),
          ),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          this.logger.warn(`Expo push refused a batch: HTTP ${response.status}`);
          continue;
        }
        const tickets = ((await response.json()) as { data?: ExpoTicket[] }).data ?? [];
        tickets.forEach((ticket, index) => {
          const token = batch[index]?.token;
          if (token && ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered')
            invalidTokens.push(token);
        });
      } catch {
        this.logger.warn('Expo push request failed');
      }
    }
    return { invalidTokens };
  }
}

import { decode, encode } from '@msgpack/msgpack';

/** Close codes from the Rust gateway (crates/vyra-realtime/src/protocol.rs). */
export const CLOSE = { SIGNED_OUT: 4000, UNAUTHORIZED: 4001 } as const;

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

interface Handlers {
  readonly onEvent: (event: string, payload: unknown) => void;
  /** Connected and authenticated (again): a good moment to catch up. */
  readonly onReady: () => void;
  /** The token was refused; the caller refreshes it and starts a new client. */
  readonly onUnauthorized: () => void;
}

interface Frame {
  readonly t?: unknown;
  readonly e?: unknown;
  readonly d?: unknown;
}

/**
 * One connection to the realtime gateway: binary MessagePack frames, the
 * token sent in the first frame (never in the URL), heartbeats, and
 * reconnection with jittered exponential backoff.
 */
export class GatewayClient {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempt = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly handlers: Handlers,
  ) {
    this.open();
  }

  send(frame: Readonly<Record<string, unknown>>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode(frame));
  }

  stop(): void {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.clearHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private open(): void {
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.addEventListener('open', () => this.send({ t: 'auth', token: this.token }));
    ws.addEventListener('message', (message: MessageEvent) => {
      let frame: Frame;
      try {
        frame = decode(new Uint8Array(message.data as ArrayBuffer)) as Frame;
      } catch {
        return;
      }
      if (frame.t === 'ready') {
        this.attempt = 0;
        this.clearHeartbeat();
        this.heartbeat = setInterval(() => this.send({ t: 'ping' }), HEARTBEAT_MS);
        this.handlers.onReady();
      } else if (frame.t === 'event' && typeof frame.e === 'string') {
        this.handlers.onEvent(frame.e, frame.d);
      }
    });
    ws.addEventListener('close', (event: CloseEvent) => {
      this.clearHeartbeat();
      if (this.stopped || this.ws !== ws) return;
      if (event.code === CLOSE.UNAUTHORIZED) {
        this.stopped = true;
        this.handlers.onUnauthorized();
        return;
      }
      if (event.code === CLOSE.SIGNED_OUT) {
        this.stopped = true;
        return;
      }
      const backoff = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempt);
      this.attempt += 1;
      this.retry = setTimeout(() => this.open(), backoff / 2 + Math.random() * (backoff / 2));
    });
  }
}

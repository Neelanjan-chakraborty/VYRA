import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import { SOCKET_EVENTS, typingEventSchema } from '@vyra/validation';
import type { Server, Socket } from 'socket.io';
import { AccessVerifier } from '../auth/access-verifier.js';
import { MessagingService } from './messaging.service.js';
import { RealtimeService, userRoom } from './realtime.service.js';

/** At most one typing signal per conversation every two seconds from one socket. */
const TYPING_INTERVAL_MS = 2_000;

interface SocketData {
  userId?: string;
  lastTyping?: Map<string, number>;
}

/**
 * Live updates for the app. Connections must present a valid access token;
 * each joins only its own person's room. The only thing a client may send is
 * "typing"; everything else is written over HTTP.
 */
// HTTP rate limits don't apply to sockets; typing has its own limit below.
@SkipThrottle()
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  constructor(
    private readonly access: AccessVerifier,
    private readonly realtime: RealtimeService,
    private readonly messaging: MessagingService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
    server.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.['token'];
      this.access
        .verify(typeof token === 'string' ? token : undefined)
        .then((auth) => {
          if (!auth) return next(new Error('unauthorized'));
          (socket.data as SocketData).userId = auth.userId;
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    await socket.join(userRoom(userId));
  }

  @SubscribeMessage(SOCKET_EVENTS.typing)
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<void> {
    const data = socket.data as SocketData;
    const parsed = typingEventSchema.safeParse(body);
    if (!data.userId || !parsed.success) return;
    const { conversationId } = parsed.data;
    data.lastTyping ??= new Map();
    const now = Date.now();
    if (now - (data.lastTyping.get(conversationId) ?? 0) < TYPING_INTERVAL_MS) return;
    data.lastTyping.set(conversationId, now);
    await this.messaging.relayTyping(data.userId, conversationId);
  }
}

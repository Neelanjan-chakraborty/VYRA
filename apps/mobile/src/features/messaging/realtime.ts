import { conversationChangedEventSchema, SOCKET_EVENTS, typingEventSchema } from '@vyra/validation';
import { useEffect } from 'react';
import { create } from 'zustand';
import { API_BASE_URL, refreshSession } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useSession } from '@/lib/session';
import { GatewayClient } from './gateway-client';
import { CONVERSATIONS_KEY, messagesKey } from './messaging-api';

/** The Rust realtime gateway (crates/vyra-realtime). */
const REALTIME_URL =
  process.env.EXPO_PUBLIC_REALTIME_URL ??
  `${API_BASE_URL.replace(/^http/, 'ws').replace(/:4000$/, ':4001')}/v1/realtime`;

/** How long "typing…" stays up after the last signal. */
const TYPING_VISIBLE_MS = 4000;

interface TypingState {
  readonly typing: Readonly<Record<string, boolean>>;
  mark(conversationId: string): void;
  clear(conversationId: string): void;
}

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const useTypingStore = create<TypingState>((set, get) => ({
  typing: {},
  mark(conversationId) {
    clearTimeout(typingTimers.get(conversationId));
    typingTimers.set(
      conversationId,
      setTimeout(() => get().clear(conversationId), TYPING_VISIBLE_MS),
    );
    set((s) => ({ typing: { ...s.typing, [conversationId]: true } }));
  },
  clear(conversationId) {
    clearTimeout(typingTimers.get(conversationId));
    typingTimers.delete(conversationId);
    set((s) => ({ typing: { ...s.typing, [conversationId]: false } }));
  },
}));

let client: GatewayClient | null = null;

/** Tells the other person you're typing, if you share that. The gateway decides. */
export function sendTyping(conversationId: string): void {
  client?.send({ t: 'typing', c: conversationId });
}

/** True for a few seconds after the other person typed. */
export function useIsTyping(conversationId: string): boolean {
  return useTypingStore((s) => s.typing[conversationId] ?? false);
}

/** Only what is on screen refetches now; the rest refreshes when it is next shown. */
function refreshPeopleLists(): void {
  for (const key of [CONVERSATIONS_KEY, ['connections'], ['relationship'], ['recommendations']])
    void queryClient.invalidateQueries({ queryKey: key, refetchType: 'active' });
}

/**
 * Keeps one socket open while signed in. Events only say what changed; the
 * app then refetches over HTTP, so nothing private travels over the socket.
 */
export function useRealtime(): void {
  const accessToken = useSession((s) => s.accessToken);
  useEffect(() => {
    if (!accessToken) return undefined;
    const current = new GatewayClient(REALTIME_URL, accessToken, {
      onReady: refreshPeopleLists, // catch up on anything missed while disconnected
      onUnauthorized: () => void refreshSession(), // a new token starts a new client
      onEvent(name, payload) {
        if (name === SOCKET_EVENTS.conversationChanged) {
          const event = conversationChangedEventSchema.safeParse(payload);
          if (!event.success) return;
          void queryClient.invalidateQueries({ queryKey: messagesKey(event.data.conversationId) });
          void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
          // Their new message ends "typing…" (your own message doesn't).
          const me = queryClient.getQueryData<{ id: string }>(['me'])?.id;
          if (
            event.data.reason === 'message' &&
            event.data.by !== undefined &&
            event.data.by !== me
          )
            useTypingStore.getState().clear(event.data.conversationId);
        } else if (name === SOCKET_EVENTS.typing) {
          const event = typingEventSchema.safeParse(payload);
          if (event.success) useTypingStore.getState().mark(event.data.conversationId);
        } else if (name === SOCKET_EVENTS.listChanged) {
          refreshPeopleLists();
        }
      },
    });
    client = current;
    return () => {
      current.stop();
      if (client === current) client = null;
    };
  }, [accessToken]);
}

import { conversationChangedEventSchema, SOCKET_EVENTS, typingEventSchema } from '@vyra/validation';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { API_BASE_URL, refreshSession } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useSession } from '@/lib/session';
import { CONVERSATIONS_KEY, messagesKey } from './messaging-api';

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

let socket: Socket | null = null;

/** Tells the other person you're typing, if you share that. The server decides. */
export function sendTyping(conversationId: string): void {
  socket?.emit(SOCKET_EVENTS.typing, { conversationId });
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
    const current = io(API_BASE_URL, {
      path: '/v1/socket',
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnectionDelayMax: 10_000,
    });
    socket = current;
    current.on(SOCKET_EVENTS.conversationChanged, (payload: unknown) => {
      const event = conversationChangedEventSchema.safeParse(payload);
      if (!event.success) return;
      void queryClient.invalidateQueries({ queryKey: messagesKey(event.data.conversationId) });
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      // A new message ends "typing…".
      if (event.data.reason === 'message')
        useTypingStore.getState().clear(event.data.conversationId);
    });
    current.on(SOCKET_EVENTS.typing, (payload: unknown) => {
      const event = typingEventSchema.safeParse(payload);
      if (event.success) useTypingStore.getState().mark(event.data.conversationId);
    });
    current.on(SOCKET_EVENTS.listChanged, refreshPeopleLists);
    // Catch up on anything missed while disconnected.
    current.on('connect', refreshPeopleLists);
    current.on('connect_error', (error: Error) => {
      // An expired access token: refreshing it changes accessToken and reconnects.
      if (error.message === 'unauthorized') {
        current.disconnect();
        void refreshSession();
      }
    });
    return () => {
      current.disconnect();
      if (socket === current) socket = null;
    };
  }, [accessToken]);
}

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import {
  type ConversationSettings,
  conversationListSchema,
  conversationSettingsSchema,
  type DatePlanInput,
  type MessagePage,
  messagePageSchema,
  messageSchema,
  type MessageView,
  pinnedListSchema,
  type Reaction,
  scheduledListSchema,
  scheduledMessageSchema,
  type WingmanPurpose,
  wingmanSuggestionsSchema,
} from '@vyra/validation';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { MEDIA_REFRESH_MS, queryClient } from '@/lib/query-client';

export const CONVERSATIONS_KEY = ['conversations'] as const;
export const messagesKey = (id: string) => ['messages', id] as const;

/** A client-generated id; resending with it never creates a second message. */
export function newClientId(): string {
  return globalThis.crypto.randomUUID();
}

export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => api('/conversations', { schema: conversationListSchema }),
    staleTime: 30_000,
    refetchInterval: MEDIA_REFRESH_MS,
  });
}

/** One conversation's summary, taken from the list so both stay in step. */
export function useConversation(id: string) {
  const list = useConversations();
  return { ...list, data: list.data?.conversations.find((c) => c.id === id) };
}

export function useMessages(conversationId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api(`/conversations/${conversationId}/messages${pageParam ? `?before=${pageParam}` : ''}`, {
        schema: messagePageSchema,
      }),
    getNextPageParam: (last: MessagePage) => last.nextBefore ?? undefined,
    // Media URLs are signed for ten minutes.
    staleTime: 3 * 60_000,
    refetchInterval: MEDIA_REFRESH_MS,
  });
}

function refreshConversation(conversationId: string): void {
  void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
  void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
}

/** Shows a just-sent message at once, then lets the server's copy replace it. */
function addOptimistic(conversationId: string, message: MessageView): void {
  queryClient.setQueryData<{ pages: MessagePage[]; pageParams: unknown[] }>(
    messagesKey(conversationId),
    (data) => {
      if (!data) return data;
      const [first, ...rest] = data.pages;
      if (!first) return data;
      return { ...data, pages: [{ ...first, messages: [message, ...first.messages] }, ...rest] };
    },
  );
}

function pendingMessage(
  conversationId: string,
  clientId: string,
  fields: Partial<MessageView>,
): MessageView {
  return {
    id: clientId,
    conversationId,
    clientId,
    mine: true,
    kind: 'text',
    body: null,
    removed: false,
    media: null,
    plan: null,
    event: null,
    read: false,
    replyTo: null,
    reactions: [],
    edited: false,
    pinned: false,
    forwarded: false,
    editable: false,
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

export function useSendText(conversationId: string) {
  return useMutation({
    mutationFn: ({
      replyTo: _quoted,
      ...input
    }: {
      body: string;
      clientId: string;
      aiAssisted?: boolean;
      replyToId?: string;
      replyTo?: MessageView['replyTo'];
    }) =>
      api(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { kind: 'text', ...input },
        schema: messageSchema,
      }),
    onMutate: ({ body, clientId, replyTo }) =>
      addOptimistic(
        conversationId,
        pendingMessage(conversationId, clientId, { body, replyTo: replyTo ?? null }),
      ),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function useSendPlan(conversationId: string) {
  return useMutation({
    mutationFn: (plan: DatePlanInput) =>
      api(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { kind: 'date_plan', clientId: newClientId(), plan },
        schema: messageSchema,
      }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export interface PickedMedia {
  readonly uri: string;
  readonly mimeType?: string;
  /** Present on web, where pickers and recorders return real files. */
  readonly file?: Blob;
}

function mediaForm(
  media: PickedMedia,
  fields: Record<string, string>,
  fallbackName: string,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (Platform.OS === 'web' && media.file) {
    form.append('file', media.file, fallbackName);
  } else {
    // React Native's FormData accepts this file descriptor in place of a Blob.
    form.append('file', {
      uri: media.uri,
      name: fallbackName,
      type: media.mimeType ?? 'application/octet-stream',
    } as unknown as Blob);
  }
  return form;
}

export function useSendPhoto(conversationId: string) {
  return useMutation({
    mutationFn: (image: PickedMedia) =>
      api(`/conversations/${conversationId}/media`, {
        method: 'POST',
        body: mediaForm(image, { kind: 'image', clientId: newClientId() }, 'photo.jpg'),
        schema: messageSchema,
      }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function useSendVoice(conversationId: string) {
  return useMutation({
    mutationFn: ({ audio, durationMs }: { audio: PickedMedia; durationMs: number }) =>
      api(`/conversations/${conversationId}/media`, {
        method: 'POST',
        body: mediaForm(
          audio,
          { kind: 'voice', clientId: newClientId(), durationMs: String(Math.round(durationMs)) },
          audio.mimeType?.includes('webm') ? 'voice.webm' : 'voice.m4a',
        ),
        schema: messageSchema,
      }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function useMarkRead(conversationId: string) {
  return useMutation({
    mutationFn: (upTo: string) =>
      api(`/conversations/${conversationId}/read`, { method: 'POST', body: { upTo } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

export function useConversationSettings(conversationId: string) {
  return useMutation({
    mutationFn: (update: Partial<ConversationSettings>) =>
      api(`/conversations/${conversationId}/settings`, {
        method: 'PATCH',
        body: update,
        schema: conversationSettingsSchema,
      }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function useRemoveMessage(conversationId: string) {
  return useMutation({
    mutationFn: (messageId: string) => api(`/messages/${messageId}`, { method: 'DELETE' }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function usePlanResponse(conversationId: string) {
  return useMutation({
    mutationFn: ({
      messageId,
      action,
    }: {
      messageId: string;
      action: 'accept' | 'decline' | 'withdraw';
    }) => api(`/messages/${messageId}/plan/${action}`, { method: 'POST', schema: messageSchema }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function useReportMessage(conversationId: string) {
  return useMutation({
    mutationFn: (input: {
      reportedUserId: string;
      messageId: string;
      reason: 'HARASSMENT' | 'INAPPROPRIATE_CONTENT' | 'SPAM_OR_SCAM' | 'OTHER';
    }) => api('/reports', { method: 'POST', body: input }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function useWingman(conversationId: string) {
  return useMutation({
    mutationFn: (purpose: WingmanPurpose) =>
      api(`/conversations/${conversationId}/wingman`, {
        method: 'POST',
        body: { purpose },
        schema: wingmanSuggestionsSchema,
      }),
  });
}

export function useReaction(conversationId: string) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: Reaction | null }) =>
      api(`/messages/${messageId}/reaction`, {
        method: emoji ? 'PUT' : 'DELETE',
        ...(emoji ? { body: { emoji } } : {}),
        schema: messageSchema,
      }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export const pinnedKey = (id: string) => ['pinned', id] as const;

export function usePinned(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: pinnedKey(conversationId),
    enabled,
    queryFn: () => api(`/conversations/${conversationId}/pinned`, { schema: pinnedListSchema }),
    staleTime: 60_000,
  });
}

export function usePin(conversationId: string) {
  return useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) =>
      api(`/messages/${messageId}/pin`, {
        method: pinned ? 'POST' : 'DELETE',
        schema: messageSchema,
      }),
    onSettled: () => {
      refreshConversation(conversationId);
      void queryClient.invalidateQueries({ queryKey: pinnedKey(conversationId) });
    },
  });
}

export function useEditMessage(conversationId: string) {
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      api(`/messages/${messageId}`, { method: 'PATCH', body: { body }, schema: messageSchema }),
    onSettled: () => refreshConversation(conversationId),
  });
}

export function useForward() {
  return useMutation({
    mutationFn: ({
      messageId,
      conversationIds,
    }: {
      messageId: string;
      conversationIds: string[];
    }) => api(`/messages/${messageId}/forward`, { method: 'POST', body: { conversationIds } }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

export const scheduledKey = (id: string) => ['scheduled', id] as const;

export function useScheduled(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: scheduledKey(conversationId),
    enabled,
    queryFn: () =>
      api(`/conversations/${conversationId}/scheduled`, { schema: scheduledListSchema }),
    refetchInterval: 60_000,
  });
}

export function useScheduleMessage(conversationId: string) {
  return useMutation({
    mutationFn: (input: { body: string; sendAt: string }) =>
      api(`/conversations/${conversationId}/scheduled`, {
        method: 'POST',
        body: input,
        schema: scheduledMessageSchema,
      }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: scheduledKey(conversationId) }),
  });
}

export function useCancelScheduled(conversationId: string) {
  return useMutation({
    mutationFn: (scheduledId: string) => api(`/scheduled/${scheduledId}`, { method: 'DELETE' }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: scheduledKey(conversationId) }),
  });
}

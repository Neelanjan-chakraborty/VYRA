import { z } from 'zod';
import { personSummarySchema, withoutControlCharacters } from './connections.js';

export const MESSAGE_BODY_MAX = 2000;
export const MESSAGES_PAGE_SIZE = 40;
/** Voice notes: at most a minute and 2 MB. */
export const VOICE_MAX_MS = 60_000;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const MESSAGE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const DATE_PLAN_LIMITS = { idea: 120, when: 80, area: 80 } as const;
export const WINGMAN_SUGGESTION_MAX = 300;
export const WINGMAN_MAX_SUGGESTIONS = 3;
/** Messages Wingman may read when the requester allowed it for that conversation. */
export const WINGMAN_CONTEXT_MESSAGES = 20;

/** Plain text: control characters removed, trimmed, then length-checked. */
const plainText = (max: number) =>
  z
    .string()
    .transform((value) => withoutControlCharacters(value).trim())
    .pipe(z.string().min(1).max(max));

export const messageBodySchema = plainText(MESSAGE_BODY_MAX);

export const datePlanInputSchema = z.object({
  idea: plainText(DATE_PLAN_LIMITS.idea),
  /** Free text such as "Saturday afternoon". */
  when: plainText(DATE_PLAN_LIMITS.when).optional(),
  /** A neighbourhood or venue name typed by the person. Never coordinates. */
  area: plainText(DATE_PLAN_LIMITS.area).optional(),
});
export type DatePlanInput = z.input<typeof datePlanInputSchema>;

export const datePlanStatusSchema = z.enum(['proposed', 'accepted', 'declined', 'withdrawn']);
export type DatePlanStatus = z.infer<typeof datePlanStatusSchema>;

/** Stored in `messages.payload` for DATE_PLAN messages. */
export const datePlanPayloadSchema = z.object({
  idea: z.string(),
  when: z.string().nullable(),
  area: z.string().nullable(),
  status: datePlanStatusSchema,
  respondedAt: z.iso.datetime().nullable(),
});
export type DatePlanPayload = z.infer<typeof datePlanPayloadSchema>;

export const sendMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    /** Client-generated; resending the same id never creates a second message. */
    clientId: z.uuid(),
    body: messageBodySchema,
    /** The text started as a Wingman suggestion the sender edited or kept. */
    aiAssisted: z.boolean().default(false),
  }),
  z.object({ kind: z.literal('date_plan'), clientId: z.uuid(), plan: datePlanInputSchema }),
]);
export type SendMessage = z.input<typeof sendMessageSchema>;

/** Multipart fields that accompany an uploaded photo or voice note. */
export const mediaMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('image'), clientId: z.uuid() }),
  z.object({
    kind: z.literal('voice'),
    clientId: z.uuid(),
    /** As measured by the recorder. The file's own duration wins when it has one. */
    durationMs: z.coerce.number().int().min(1).max(VOICE_MAX_MS),
  }),
]);
export type MediaMessageFields = z.input<typeof mediaMessageSchema>;

export const messageKindSchema = z.enum(['text', 'image', 'voice', 'date_plan', 'system']);
export type MessageKindView = z.infer<typeof messageKindSchema>;

export const messageMediaSchema = z.object({
  /** "checking" until moderation approves it; the other person never gets a URL before then. */
  status: z.enum(['checking', 'ready', 'declined']),
  /** Short-lived signed URL, only when ready (or to the sender while it is checked). */
  url: z.string().nullable(),
  /** IMAGE: a small version for the bubble. */
  thumbUrl: z.string().nullable(),
  /** VOICE: the same audio in a CAF container, for iOS's native player. */
  altUrl: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
});
export type MessageMedia = z.infer<typeof messageMediaSchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  clientId: z.uuid().nullable(),
  /** Sent by the viewer. */
  mine: z.boolean(),
  kind: messageKindSchema,
  /** null for media, plans, system messages and removed messages. */
  body: z.string().nullable(),
  removed: z.boolean(),
  media: messageMediaSchema.nullable(),
  plan: datePlanPayloadSchema.nullable(),
  /** System messages only, e.g. "connected". */
  event: z.enum(['connected']).nullable(),
  /** The viewer's own messages only: the other person has read it (when both share receipts). */
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type MessageView = z.infer<typeof messageSchema>;

export const messagePageSchema = z.object({
  messages: z.array(messageSchema),
  /** Pass as `before` to load older messages; null at the start of the conversation. */
  nextBefore: z.uuid().nullable(),
});
export type MessagePage = z.infer<typeof messagePageSchema>;

export const conversationSettingsSchema = z.object({
  sendsReadReceipts: z.boolean(),
  sharesTyping: z.boolean(),
  /** Wingman may read recent messages in this conversation when this person asks it for help. */
  wingmanContextEnabled: z.boolean(),
  muted: z.boolean(),
});
export type ConversationSettings = z.infer<typeof conversationSettingsSchema>;
export const conversationSettingsUpdateSchema = conversationSettingsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to change');

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  person: personSummarySchema,
  /** A short preview: text is cut, media and plans are described in words. */
  lastMessage: z
    .object({ preview: z.string(), mine: z.boolean(), at: z.iso.datetime() })
    .nullable(),
  /** Something new from them. A dot, never a count. */
  unread: z.boolean(),
  /** The connection ended or someone blocked: history stays, nobody can send. */
  readOnly: z.boolean(),
  settings: conversationSettingsSchema,
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export const conversationListSchema = z.object({
  conversations: z.array(conversationSummarySchema),
});
export type ConversationList = z.infer<typeof conversationListSchema>;

export const markReadSchema = z.object({ upTo: z.uuid() });

export const pushDeviceSchema = z.object({
  token: z.string().trim().min(10).max(255),
  platform: z.enum(['ios', 'android', 'web']),
});
export type PushDeviceInput = z.infer<typeof pushDeviceSchema>;

export const wingmanPurposeSchema = z.enum(['opener', 'reply', 'date_idea']);
export type WingmanPurpose = z.infer<typeof wingmanPurposeSchema>;
export const wingmanRequestSchema = z.object({ purpose: wingmanPurposeSchema });
export const wingmanSuggestionsSchema = z.object({
  suggestions: z.array(z.string().max(WINGMAN_SUGGESTION_MAX)).max(WINGMAN_MAX_SUGGESTIONS),
  /** Whether recent messages were part of the context (only if the requester allowed it). */
  usedMessages: z.boolean(),
});
export type WingmanSuggestions = z.infer<typeof wingmanSuggestionsSchema>;

/** Events the server pushes over the socket. All carry ids only, never message text. */
export const SOCKET_EVENTS = {
  /** Something in this conversation changed: fetch it. */
  conversationChanged: 'conversation.changed',
  typing: 'typing',
  /** Connections or the conversation list changed. */
  listChanged: 'list.changed',
} as const;
export const conversationChangedEventSchema = z.object({
  conversationId: z.uuid(),
  reason: z.enum(['message', 'removed', 'read', 'media', 'plan', 'ended']),
  /** Who caused it (an id only), so an app can tell its own actions from the other person's. */
  by: z.uuid().optional(),
});
export type ConversationChangedEvent = z.infer<typeof conversationChangedEventSchema>;
export const typingEventSchema = z.object({ conversationId: z.uuid() });
export type TypingEvent = z.infer<typeof typingEventSchema>;

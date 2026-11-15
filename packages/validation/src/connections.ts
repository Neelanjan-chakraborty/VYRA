import { z } from 'zod';
import { sufficiencySchema } from './compatibility.js';

/** How long a pass keeps someone out of recommendations. */
export const PASS_HIDE_DAYS = 30;
/** After a decline, the same person can't ask again for this long. */
export const DECLINE_COOLDOWN_DAYS = 30;
/** Most unanswered requests one person can have out at once. */
export const MAX_PENDING_OUTGOING = 20;
export const CONNECTION_NOTE_MAX = 300;

/** Drops control characters except tab, line feed and carriage return. */
export function withoutControlCharacters(value: string): string {
  return [...value]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
}

/** A short, plain-text note. Control characters are removed; it is always shown as text. */
export const connectionNoteSchema = z
  .string()
  .transform((value) => withoutControlCharacters(value).trim())
  .pipe(z.string().max(CONNECTION_NOTE_MAX));

export const connectionRequestCreateSchema = z.object({
  recipientId: z.uuid(),
  note: connectionNoteSchema.optional(),
});
export type ConnectionRequestCreate = z.input<typeof connectionRequestCreateSchema>;

/** A person as shown in Connections. Same visibility rules as everywhere: approved photos only. */
export const personSummarySchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  age: z.number().int(),
  city: z.string().nullable(),
  photoUrl: z.string().nullable(),
  distance: z.string().nullable(),
  overall: z.number().min(0).max(1).nullable(),
  sufficiency: sufficiencySchema,
});
export type PersonSummary = z.infer<typeof personSummarySchema>;

export const connectionItemSchema = z.object({
  /** Request id for requests, match id for mutual connections, null for saved. */
  id: z.uuid().nullable(),
  person: personSummarySchema,
  /** The sender's note. Present only on incoming requests and only for the recipient, or on your own outgoing ones. */
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  /** Mutual connections only: where to talk. */
  conversationId: z.uuid().nullable(),
});
export type ConnectionItem = z.infer<typeof connectionItemSchema>;

export const connectionsSchema = z.object({
  incoming: z.array(connectionItemSchema),
  outgoing: z.array(connectionItemSchema),
  mutual: z.array(connectionItemSchema),
  saved: z.array(connectionItemSchema),
});
export type Connections = z.infer<typeof connectionsSchema>;

/** Where the viewer stands with one person; drives the actions on a profile. */
export const relationshipStateSchema = z.object({
  saved: z.boolean(),
  /** Pending request the viewer sent. */
  outgoingRequestId: z.uuid().nullable(),
  /** Pending request the other person sent. */
  incomingRequestId: z.uuid().nullable(),
  /** Active mutual connection. */
  matchId: z.uuid().nullable(),
  /** The conversation with them, while connected. */
  conversationId: z.uuid().nullable(),
  /** Why the viewer can't send a request right now, if they can't. */
  requestBlockedReason: z.enum(['declined_recently', 'too_many_pending']).nullable(),
});
export type RelationshipState = z.infer<typeof relationshipStateSchema>;

export const connectResultSchema = z.object({
  /** "matched" when the other person had already asked: it became mutual at once. */
  outcome: z.enum(['requested', 'matched']),
  requestId: z.uuid(),
  matchId: z.uuid().nullable(),
});
export type ConnectResult = z.infer<typeof connectResultSchema>;

export const blockedListSchema = z.object({
  blocked: z.array(
    z.object({ userId: z.uuid(), displayName: z.string(), blockedAt: z.iso.datetime() }),
  ),
});
export type BlockedList = z.infer<typeof blockedListSchema>;

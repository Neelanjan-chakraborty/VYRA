import type { MessageView } from '@vyra/validation';

/** Messages from one person within this window read as a single burst. */
export const BURST_WINDOW_MS = 4 * 60_000;

export interface ChatRow {
  readonly message: MessageView;
  /** The first message of a calendar day, so a date rule sits above it. */
  readonly showDate: boolean;
  /** A message that arrived while the reader was away from the bottom. */
  readonly showNew: boolean;
  readonly firstOfGroup: boolean;
  readonly lastOfGroup: boolean;
  readonly showAvatar: boolean;
  /** Time and delivery state: on the last of a burst, or when something changed. */
  readonly showMeta: boolean;
}

function isSystem(message: MessageView): boolean {
  return message.kind === 'system';
}

function sameBurst(older: MessageView | undefined, message: MessageView | undefined): boolean {
  if (!older || !message) return false;
  if (isSystem(older) || isSystem(message)) return false;
  if (older.mine !== message.mine) return false;
  return (
    Math.abs(new Date(older.createdAt).getTime() - new Date(message.createdAt).getTime()) <=
    BURST_WINDOW_MS
  );
}

export function sameDay(a: string, b: string): boolean {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

/** "Today", "Yesterday", "4 Nov", or the year when it is not this one. */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (sameDay(iso, now.toISOString())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(iso, yesterday.toISOString())) return 'Yesterday';
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

export interface BuildRowsOptions {
  /** Messages that arrived after the reader left the bottom. */
  readonly newSinceId?: string | null;
  /** Optimistic messages that have not been confirmed yet. */
  readonly pendingIds?: ReadonlySet<string>;
}

/**
 * Turns the API's newest-first page into renderable rows.
 *
 * The list is inverted, so index 0 is the newest message and `index + 1` is
 * older. A row carries the grouping information its bubble needs; no message
 * is reordered or duplicated.
 */
export function buildChatRows(
  messages: readonly MessageView[],
  options: BuildRowsOptions = {},
): ChatRow[] {
  return messages.map((message, index) => {
    const older = messages[index + 1];
    const newer = messages[index - 1];
    const system = isSystem(message);
    const firstOfGroup = !sameBurst(older, message);
    const lastOfGroup = !sameBurst(message, newer);
    const dayChanged = !older || !sameDay(older.createdAt, message.createdAt);
    // The connected line already carries its date, so a second rule would repeat it.
    const olderIsConnection =
      older?.kind === 'system' &&
      older.event === 'connected' &&
      sameDay(older.createdAt, message.createdAt);

    return {
      message,
      showDate: !system && dayChanged && !olderIsConnection,
      showNew: options.newSinceId === message.id,
      firstOfGroup,
      lastOfGroup,
      showAvatar: !message.mine && !system && lastOfGroup,
      showMeta:
        !system &&
        (lastOfGroup ||
          message.edited ||
          message.pinned ||
          message.reactions.length > 0 ||
          options.pendingIds?.has(message.id) === true),
    };
  });
}

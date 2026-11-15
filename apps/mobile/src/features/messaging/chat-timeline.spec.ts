import type { MessageView } from '@vyra/validation';
import { describe, expect, it } from 'vitest';
import { buildChatRows, BURST_WINDOW_MS, dayLabel, sameDay } from './chat-timeline';

function message(
  overrides: Partial<MessageView> & Pick<MessageView, 'id' | 'createdAt'>,
): MessageView {
  return {
    conversationId: 'conversation',
    clientId: null,
    mine: false,
    kind: 'text',
    body: 'A message',
    removed: false,
    media: null,
    plan: null,
    event: null,
    theme: null,
    disappearSeconds: null,
    removedReason: null,
    viewOnce: false,
    timerSeconds: null,
    sensitive: false,
    savable: false,
    blurred: false,
    held: false,
    openable: false,
    openedAt: null,
    expiresAt: null,
    read: false,
    replyTo: null,
    reactions: [],
    edited: false,
    pinned: false,
    forwarded: false,
    editable: false,
    ...overrides,
  };
}

const at = (minutes: number) => new Date(2026, 10, 15, 12, minutes).toISOString();

describe('chat timeline', () => {
  it('groups consecutive messages from one person inside the burst window', () => {
    const rows = buildChatRows([
      message({ id: 'newest', createdAt: at(3) }),
      message({ id: 'middle', createdAt: at(2) }),
      message({ id: 'oldest', createdAt: at(1) }),
    ]);

    expect(rows.map((row) => row.firstOfGroup)).toEqual([false, false, true]);
    expect(rows.map((row) => row.lastOfGroup)).toEqual([true, false, false]);
    expect(rows.map((row) => row.showAvatar)).toEqual([true, false, false]);
    expect(rows.map((row) => row.showMeta)).toEqual([true, false, false]);
  });

  it('starts a new burst after the window or when the sender changes', () => {
    const rows = buildChatRows([
      message({ id: 'mine', createdAt: at(20), mine: true }),
      message({
        id: 'theirs',
        createdAt: at(1),
        mine: false,
        reactions: [{ emoji: '❤️', count: 1, mine: true }],
      }),
    ]);

    expect(rows[0]?.firstOfGroup).toBe(true);
    expect(rows[0]?.lastOfGroup).toBe(true);
    expect(rows[0]?.showMeta).toBe(true);
    expect(rows[1]?.showAvatar).toBe(true);
    expect(rows[1]?.showMeta).toBe(true);
  });

  it('does not repeat the date after a same-day connected line', () => {
    const rows = buildChatRows([
      message({ id: 'hello', createdAt: at(2) }),
      message({
        id: 'connected',
        createdAt: at(0),
        kind: 'system',
        event: 'connected',
        body: null,
      }),
    ]);

    expect(rows[0]?.showDate).toBe(false);
    expect(rows[0]?.firstOfGroup).toBe(true);
    expect(rows[1]?.showDate).toBe(false);
  });

  it('still marks a new day when the connected line was the day before', () => {
    const nextDay = new Date(2026, 10, 16, 9, 0).toISOString();
    const rows = buildChatRows([
      message({ id: 'morning', createdAt: nextDay }),
      message({
        id: 'connected',
        createdAt: at(0),
        kind: 'system',
        event: 'connected',
        body: null,
      }),
    ]);

    expect(rows[0]?.showDate).toBe(true);
  });

  it('marks only the requested message as new', () => {
    const rows = buildChatRows(
      [message({ id: 'b', createdAt: at(2) }), message({ id: 'a', createdAt: at(1) })],
      { newSinceId: 'a' },
    );
    expect(rows.map((row) => row.showNew)).toEqual([false, true]);
  });

  it('keeps optimistic messages visible in time', () => {
    const rows = buildChatRows([message({ id: 'pending', createdAt: at(1), mine: true })], {
      pendingIds: new Set(['pending']),
    });
    expect(rows[0]?.showMeta).toBe(true);
  });

  it('uses the burst window inclusively', () => {
    const rows = buildChatRows([
      message({ id: 'later', createdAt: at(0) }),
      message({
        id: 'earlier',
        createdAt: new Date(
          new Date(2026, 10, 15, 12, 0).getTime() - BURST_WINDOW_MS,
        ).toISOString(),
      }),
    ]);
    expect(rows[0]?.firstOfGroup).toBe(false);
  });
});

describe('day labels', () => {
  const now = new Date(2026, 10, 15, 12, 0);

  it('recognises today and yesterday', () => {
    expect(dayLabel(new Date(2026, 10, 15, 8, 0).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 14, 23, 0).toISOString(), now)).toBe('Yesterday');
  });

  it('includes the year only when it differs', () => {
    expect(dayLabel(new Date(2025, 10, 15, 8, 0).toISOString(), now)).toContain('2025');
    expect(dayLabel(new Date(2026, 9, 2, 8, 0).toISOString(), now)).not.toContain('2026');
  });

  it('compares calendar days, not instants', () => {
    expect(sameDay(at(0), at(1))).toBe(true);
    expect(sameDay(at(0), new Date(2026, 10, 16, 0, 1).toISOString())).toBe(false);
  });
});

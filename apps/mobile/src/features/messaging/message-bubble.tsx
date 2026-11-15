import { type ChatTheme, chatThemes, color, radius, space } from '@vyra/design-system';
import type { MessageView, Reaction } from '@vyra/validation';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import {
  BlurredMedia,
  HeldMedia,
  remaining,
  timerLabel,
  useNow,
  VideoMessage,
} from './media-views';
import { VoiceNote } from './voice';

const DISAPPEAR_WORDS: Readonly<Record<number, string>> = {
  86_400: '24 hours',
  604_800: '7 days',
  7_776_000: '90 days',
};

const PLAN_STATUS: Readonly<Record<string, string>> = {
  proposed: 'Waiting for an answer',
  accepted: 'You’re both in',
  declined: 'Not this time',
  withdrawn: 'Withdrawn',
};

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface BubbleProps {
  readonly message: MessageView;
  readonly otherName: string;
  /** Pending: sent from this device and not yet confirmed. */
  readonly pending: boolean;
  readonly canAct: boolean;
  readonly onActions: (message: MessageView) => void;
  readonly onPlan: (message: MessageView, action: 'accept' | 'decline' | 'withdraw') => void;
  /** Tapping a reaction chip: yours toggles off, another replaces yours. */
  readonly onReact: (message: MessageView, emoji: Reaction | null) => void;
  /** View-once or timed media: ask the server for it. */
  readonly onOpen: (message: MessageView) => void;
  /** Allow photos, video and voice from the other person (null when not possible). */
  readonly onAllowMedia: (() => void) | null;
  readonly theme: ChatTheme;
}

/** One message. Text is always rendered as plain text, never as markup or links. */
export function MessageBubble({
  message,
  otherName,
  pending,
  canAct,
  onActions,
  onPlan,
  onReact,
  onOpen,
  onAllowMedia,
  theme,
}: BubbleProps) {
  const [revealed, setRevealed] = useState(false);
  const now = useNow(Boolean(message.expiresAt) && !message.removed);
  if (message.kind === 'system' && message.event === 'theme') {
    const label = chatThemes[message.theme ?? 'default'].label;
    return (
      <Text variant="caption" tone="textSecondary" style={styles.system}>
        {message.mine ? 'You' : otherName} changed the theme to {label}
      </Text>
    );
  }
  if (message.kind === 'system' && message.event === 'disappear') {
    const who = message.mine ? 'You' : otherName;
    return (
      <Text variant="caption" tone="textSecondary" style={styles.system}>
        {message.disappearSeconds
          ? `${who} turned on disappearing messages: new messages go after ${DISAPPEAR_WORDS[message.disappearSeconds] ?? 'a while'}`
          : `${who} turned off disappearing messages`}
      </Text>
    );
  }
  if (message.kind === 'system') {
    return (
      <Text variant="caption" tone="textSecondary" style={styles.system}>
        You and {otherName} are connected · {new Date(message.createdAt).toLocaleDateString()}
      </Text>
    );
  }
  const mine = message.mine;
  const palette = chatThemes[theme];
  const ink = mine ? palette.mineText : color.textPrimary;
  const left = remaining(message.expiresAt, now);
  const status = [
    message.pinned ? 'Pinned' : null,
    message.edited ? 'Edited' : null,
    message.kind === 'text' && message.timerSeconds && !message.expiresAt && !message.removed
      ? `Disappears ${timerLabel(message.timerSeconds)} after it’s read`
      : null,
    mine && message.viewOnce && !message.removed
      ? message.openedAt
        ? 'Opened'
        : 'View once'
      : null,
    mine && message.timerSeconds && message.kind !== 'text' && !message.openedAt && !message.removed
      ? `${timerLabel(message.timerSeconds)} after opening`
      : null,
    mine && message.held ? `${otherName} hasn’t allowed media yet` : null,
    left ? `Disappears in ${left}` : null,
    pending ? 'Sending…' : mine && message.read ? 'Read' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  let content;
  const protectedTheirs =
    !mine && (message.viewOnce || (message.timerSeconds !== null && message.kind !== 'text'));
  if (message.removed) {
    content = (
      <Text tone="textSecondary" style={styles.removed}>
        {message.removedReason === 'opened'
          ? 'Opened'
          : message.removedReason === 'expired'
            ? 'Disappeared'
            : mine
              ? 'You removed this message'
              : 'Message removed'}
      </Text>
    );
  } else if (message.held && !mine) {
    content = <HeldMedia message={message} otherName={otherName} onAllow={onAllowMedia} />;
  } else if (protectedTheirs) {
    const what =
      { image: 'Photo', video: 'Video', voice: 'Voice note' }[message.kind as 'image'] ?? 'Media';
    const ready = message.media?.status === 'ready';
    content = (
      <BlurredMedia
        message={message}
        label={
          !ready
            ? `${what} being checked`
            : message.viewOnce
              ? `${what} · view once`
              : `${what} · ${timerLabel(message.timerSeconds ?? 0)} · tap to open`
        }
        onPress={ready && message.openable ? () => onOpen(message) : null}
      />
    );
  } else if (message.blurred && !revealed && message.media?.status === 'ready') {
    content = (
      <BlurredMedia
        message={message}
        label={message.sensitive ? 'Sensitive · tap to view' : 'Tap to view'}
        onPress={() => setRevealed(true)}
      />
    );
  } else if (message.kind === 'video' && message.media) {
    const { media } = message;
    content =
      media.url && media.status === 'ready' ? (
        <VideoMessage
          url={media.url}
          posterUrl={media.posterUrl}
          width={media.width}
          height={media.height}
          durationMs={media.durationMs}
          label={mine ? 'video you sent' : `video from ${otherName}`}
        />
      ) : (
        <Text variant="caption" style={{ color: mine ? ink : color.textSecondary }}>
          {media.status === 'declined'
            ? 'This video couldn’t be sent. Try another.'
            : 'Video being prepared and checked'}
        </Text>
      );
  } else if (message.kind === 'text') {
    content = (
      <Text selectable style={{ color: ink }}>
        {message.body}
      </Text>
    );
  } else if (message.kind === 'image' && message.media) {
    const { media } = message;
    const ratio = media.width && media.height ? media.width / media.height : 0.8;
    content = (
      <View>
        {media.url ? (
          <Image
            draggable={false}
            source={{ uri: media.thumbUrl ?? media.url }}
            style={[styles.photo, { aspectRatio: ratio }, media.status !== 'ready' && styles.dim]}
            contentFit="cover"
            accessibilityLabel={mine ? 'Photo you sent' : `Photo from ${otherName}`}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder, { aspectRatio: ratio }]} />
        )}
        {media.status !== 'ready' ? (
          <Text
            variant="caption"
            style={[styles.mediaNote, { color: mine ? ink : color.textSecondary }]}
          >
            {media.status === 'checking'
              ? 'Photo being checked'
              : 'This photo couldn’t be sent. Try another.'}
          </Text>
        ) : null}
      </View>
    );
  } else if (message.kind === 'voice' && message.media?.url) {
    // iOS's native player can't read Ogg; the server also stores the same audio as CAF.
    const voiceUrl =
      Platform.OS === 'ios' && message.media.altUrl ? message.media.altUrl : message.media.url;
    content = (
      <VoiceNote url={voiceUrl} durationMs={message.media.durationMs} mine={mine} tint={ink} />
    );
  } else if (message.kind === 'date_plan' && message.plan) {
    const { plan } = message;
    const tint = ink;
    content = (
      <View style={styles.plan}>
        <Text variant="eyebrow" style={{ color: tint }}>
          Date idea
        </Text>
        <Text variant="title" style={{ color: tint }}>
          {plan.idea}
        </Text>
        {plan.when || plan.area ? (
          <Text variant="caption" style={{ color: tint }}>
            {[plan.when, plan.area].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <Text variant="caption" style={{ color: tint }}>
          {PLAN_STATUS[plan.status]}
        </Text>
        {plan.status === 'accepted' ? (
          <Text variant="caption" style={{ color: tint }}>
            Meet somewhere public and let a friend know your plans.
          </Text>
        ) : null}
        {canAct && plan.status === 'proposed' && !mine ? (
          <View style={styles.planActions}>
            <Button
              label="Not this time"
              variant="secondary"
              onPress={() => onPlan(message, 'decline')}
            />
            <Button label="I’m in" onPress={() => onPlan(message, 'accept')} />
          </View>
        ) : null}
        {canAct && plan.status === 'proposed' && mine ? (
          <Button
            label="Withdraw idea"
            variant="quiet"
            style={styles.withdraw}
            onPress={() => onPlan(message, 'withdraw')}
          />
        ) : null}
      </View>
    );
  } else {
    content = <Text tone="textSecondary">Unavailable</Text>;
  }

  const actionable = !message.removed && !pending;
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {message.forwarded && !message.removed ? (
        <Text variant="caption" tone="textSecondary" style={styles.label}>
          Forwarded
        </Text>
      ) : null}
      <Pressable
        onLongPress={actionable ? () => onActions(message) : undefined}
        accessibilityActions={actionable ? [{ name: 'activate', label: 'Message options' }] : []}
        onAccessibilityAction={() => onActions(message)}
        style={[
          styles.bubble,
          mine ? [styles.mine, { backgroundColor: palette.mine }] : styles.theirs,
          (message.kind === 'image' || message.kind === 'video') && styles.mediaBubble,
          pending && styles.dim,
        ]}
      >
        {message.replyTo && !message.removed ? (
          <View
            style={[styles.quote, { borderLeftColor: mine ? ink : color.accent }]}
            aria-label={`Replying to ${message.replyTo.mine ? 'you' : otherName}`}
          >
            <Text variant="caption" style={{ color: ink }}>
              {message.replyTo.mine ? 'You' : otherName}
            </Text>
            <Text variant="caption" numberOfLines={2} style={{ color: ink }}>
              {message.replyTo.preview}
            </Text>
          </View>
        ) : null}
        {content}
      </Pressable>
      {message.reactions.length > 0 ? (
        <View style={styles.reactions}>
          {message.reactions.map((r) => (
            <Pressable
              key={r.emoji}
              role="button"
              aria-label={`${r.emoji} ${r.count}${r.mine ? ', yours. Tap to remove' : ''}`}
              disabled={!canAct}
              onPress={() => onReact(message, r.mine ? null : r.emoji)}
              style={[styles.chip, r.mine && styles.chipMine]}
            >
              <Text variant="caption">
                {r.emoji}
                {r.count > 1 ? ` ${r.count}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text variant="caption" tone="textSecondary" style={styles.meta}>
        {time(message.createdAt)}
        {status ? ` · ${status}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  system: { textAlign: 'center', marginVertical: space.l },
  row: { marginVertical: space.xs, maxWidth: '82%' },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: radius.l, paddingHorizontal: space.m, paddingVertical: space.s },
  mine: { borderBottomRightRadius: radius.s },
  theirs: { backgroundColor: color.surfaceRaised, borderBottomLeftRadius: radius.s },
  mediaBubble: { padding: space.xs },
  removed: { fontStyle: 'italic' },
  photo: { width: 220, borderRadius: radius.m, backgroundColor: color.surface },
  photoPlaceholder: { borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  dim: { opacity: 0.6 },
  mediaNote: { marginTop: space.xs, paddingHorizontal: space.xs },
  plan: { gap: space.xs, paddingVertical: space.xs, minWidth: 220 },
  planActions: { flexDirection: 'row', gap: space.s, marginTop: space.s },
  withdraw: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  meta: { marginTop: space.xxs },
  label: { marginBottom: space.xxs },
  quote: {
    borderLeftWidth: 2,
    paddingLeft: space.s,
    marginBottom: space.xs,
    opacity: 0.85,
    maxWidth: 260,
  },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xxs, marginTop: space.xxs },
  chip: {
    minHeight: 28,
    minWidth: 36,
    paddingHorizontal: space.s,
    borderRadius: radius.l,
    backgroundColor: color.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipMine: { borderColor: color.accent },
});

import { type ChatTheme, chatThemes, color, radius, space } from '@vyra/design-system';
import type { MessageView, Reaction } from '@vyra/validation';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { PersonAvatar } from '@/features/discovery/person-avatar';
import { ChatIcon } from './chat-icons';
import { DatePlanMessage } from './date-plan-message';
import { MediaMessage } from './media-message';
import {
  BlurredMedia,
  HeldMedia,
  remaining,
  timerLabel,
  useNow,
  VideoMessage,
} from './media-views';
import { ReactionBar } from './reaction-bar';
import { VoiceNote } from './voice';

const DISAPPEAR_WORDS: Readonly<Record<number, string>> = {
  86_400: '24 hours',
  604_800: '7 days',
  7_776_000: '90 days',
};

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface BubbleProps {
  readonly message: MessageView;
  readonly otherName: string;
  readonly otherPhotoUrl: string | null;
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
  readonly firstOfGroup: boolean;
  readonly lastOfGroup: boolean;
  readonly showAvatar: boolean;
  readonly showMeta: boolean;
}

/**
 * One message. Text is always rendered as plain text, never as markup or links.
 * Bubble corners, rhythm and avatar presence come from the timeline row, so a
 * burst reads as one utterance rather than a stack of cards.
 */
export function MessageBubble({
  message,
  otherName,
  otherPhotoUrl,
  pending,
  canAct,
  onActions,
  onPlan,
  onReact,
  onOpen,
  onAllowMedia,
  theme,
  firstOfGroup,
  lastOfGroup,
  showAvatar,
  showMeta,
}: BubbleProps) {
  const [revealed, setRevealed] = useState(false);
  const now = useNow(Boolean(message.expiresAt) && !message.removed);
  if (message.kind === 'system' && message.event === 'theme') {
    const label = chatThemes[message.theme ?? 'default'].label;
    return (
      <View style={styles.systemRow}>
        <ChatIcon name="sparkle" color={color.textSecondary} size={14} />
        <Text variant="caption" tone="textSecondary" style={styles.systemText}>
          {message.mine ? 'You' : otherName} changed the theme to {label}
        </Text>
      </View>
    );
  }
  if (message.kind === 'system' && message.event === 'disappear') {
    const who = message.mine ? 'You' : otherName;
    return (
      <View style={styles.systemRow}>
        <ChatIcon name="clock" color={color.textSecondary} size={14} />
        <Text variant="caption" tone="textSecondary" style={styles.systemText}>
          {message.disappearSeconds
            ? `${who} turned on disappearing messages: new messages go after ${DISAPPEAR_WORDS[message.disappearSeconds] ?? 'a while'}`
            : `${who} turned off disappearing messages`}
        </Text>
      </View>
    );
  }
  if (message.kind === 'system') {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemRule} aria-hidden />
        <Text variant="caption" tone="chemistryText" style={styles.systemText}>
          You and {otherName} are connected · {new Date(message.createdAt).toLocaleDateString()}
        </Text>
        <View style={styles.systemRule} aria-hidden />
      </View>
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
      <Text selectable variant="message" style={{ color: ink }}>
        {message.body}
      </Text>
    );
  } else if (message.kind === 'image' && message.media) {
    content = <MediaMessage media={message.media} mine={mine} otherName={otherName} tint={ink} />;
  } else if (message.kind === 'voice' && message.media?.url) {
    // iOS's native player can't read Ogg; the server also stores the same audio as CAF.
    const voiceUrl =
      Platform.OS === 'ios' && message.media.altUrl ? message.media.altUrl : message.media.url;
    content = (
      <VoiceNote url={voiceUrl} durationMs={message.media.durationMs} mine={mine} tint={ink} />
    );
  } else if (message.kind === 'date_plan') {
    content = (
      <DatePlanMessage message={message} mine={mine} canAct={canAct} tint={ink} onPlan={onPlan} />
    );
  } else {
    content = <Text tone="textSecondary">Unavailable</Text>;
  }

  const actionable = !message.removed && !pending;
  const shape = {
    borderTopLeftRadius: !firstOfGroup && !mine ? radius.s : radius.l,
    borderTopRightRadius: !firstOfGroup && mine ? radius.s : radius.l,
    borderBottomLeftRadius: lastOfGroup && !mine ? radius.s : radius.l,
    borderBottomRightRadius: lastOfGroup && mine ? radius.s : radius.l,
  };

  return (
    <View
      style={[
        styles.row,
        mine ? styles.rowMine : styles.rowTheirs,
        firstOfGroup ? styles.rowSpaced : styles.rowTight,
      ]}
    >
      {!mine ? (
        <View style={styles.avatarColumn}>
          {showAvatar ? (
            <View style={styles.avatar}>
              <PersonAvatar name={otherName} photoUrl={otherPhotoUrl} size={24} round />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.column, mine ? styles.columnMine : styles.columnTheirs]}>
        {message.forwarded && !message.removed ? (
          <View style={styles.labelRow}>
            <ChatIcon name="forward" color={color.textSecondary} size={12} />
            <Text variant="caption" tone="textSecondary">
              Forwarded
            </Text>
          </View>
        ) : null}

        <Pressable
          onLongPress={actionable ? () => onActions(message) : undefined}
          accessibilityActions={actionable ? [{ name: 'activate', label: 'Message options' }] : []}
          onAccessibilityAction={actionable ? () => onActions(message) : undefined}
          style={({ pressed }) => [pressed && actionable && styles.pressed]}
        >
          <View
            style={[
              styles.bubble,
              mine ? { backgroundColor: palette.mine } : styles.theirs,
              shape,
              (message.kind === 'image' || message.kind === 'video') && styles.mediaBubble,
              pending && styles.dim,
            ]}
          >
            {message.replyTo && !message.removed ? (
              <View
                style={[styles.quote, { borderLeftColor: mine ? ink : color.textSecondary }]}
                aria-label={`Replying to ${message.replyTo.mine ? 'you' : otherName}`}
              >
                <Text variant="captionStrong" style={{ color: mine ? ink : color.chemistryText }}>
                  {message.replyTo.mine ? 'You' : otherName}
                </Text>
                <Text
                  variant="caption"
                  numberOfLines={2}
                  style={{ color: mine ? ink : color.textSecondary }}
                >
                  {message.replyTo.preview}
                </Text>
              </View>
            ) : null}

            {content}

            {showMeta && !message.removed ? (
              <View style={[styles.metaRow, mine ? styles.metaRowMine : styles.metaRowTheirs]}>
                {pending ? (
                  <ChatIcon name="clock" color={ink} size={11} />
                ) : mine && message.read ? (
                  <ChatIcon name="checkDouble" color={ink} size={11} />
                ) : null}
                <Text
                  variant="caption"
                  style={[styles.meta, { color: mine ? ink : color.textSecondary }]}
                >
                  {time(message.createdAt)}
                  {status ? ` · ${status}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <ReactionBar message={message} canAct={canAct} onReact={onReact} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    marginVertical: space.l,
    paddingHorizontal: space.l,
  },
  systemRule: {
    flex: 1,
    maxWidth: 48,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
  },
  systemText: { textAlign: 'center', flexShrink: 1 },
  row: { width: '100%', flexDirection: 'row', alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  rowSpaced: { marginTop: space.m },
  rowTight: { marginTop: 2 },
  avatarColumn: { width: 32, flexShrink: 0, paddingBottom: 2 },
  avatar: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden' },
  column: { flexShrink: 1, maxWidth: '82%' },
  columnMine: { alignItems: 'flex-end', maxWidth: '84%' },
  columnTheirs: { alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: space.m + 2,
    paddingVertical: space.s + 2,
    overflow: 'hidden',
  },
  theirs: { backgroundColor: color.surfaceRaised },
  mediaBubble: { padding: space.xs + 1 },
  dim: { opacity: 0.62 },
  pressed: { opacity: 0.9 },
  removed: { fontStyle: 'italic' },
  quote: {
    borderLeftWidth: 2,
    paddingLeft: space.s,
    marginBottom: space.s,
    maxWidth: 280,
    gap: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    marginBottom: space.xxs,
    paddingHorizontal: space.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    marginTop: space.xs,
  },
  metaRowMine: { justifyContent: 'flex-end' },
  metaRowTheirs: { justifyContent: 'flex-start' },
  meta: { opacity: 0.9 },
});

import { color, radius, space } from '@vyra/design-system';
import type { MessageView } from '@vyra/validation';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { VoiceNote } from './voice';

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
}

/** One message. Text is always rendered as plain text, never as markup or links. */
export function MessageBubble({
  message,
  otherName,
  pending,
  canAct,
  onActions,
  onPlan,
}: BubbleProps) {
  if (message.kind === 'system') {
    return (
      <Text variant="caption" tone="textSecondary" style={styles.system}>
        You and {otherName} are connected · {new Date(message.createdAt).toLocaleDateString()}
      </Text>
    );
  }
  const mine = message.mine;
  const status = pending ? 'Sending…' : mine && message.read ? 'Read' : null;
  let content;
  if (message.removed) {
    content = (
      <Text tone="textSecondary" style={styles.removed}>
        {mine ? 'You removed this message' : 'Message removed'}
      </Text>
    );
  } else if (message.kind === 'text') {
    content = (
      <Text selectable style={{ color: mine ? color.textOnAccent : color.textPrimary }}>
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
            style={[styles.mediaNote, { color: mine ? color.textOnAccent : color.textSecondary }]}
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
    content = <VoiceNote url={voiceUrl} durationMs={message.media.durationMs} mine={mine} />;
  } else if (message.kind === 'date_plan' && message.plan) {
    const { plan } = message;
    const tint = mine ? color.textOnAccent : color.textPrimary;
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

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onLongPress={!message.removed && !pending ? () => onActions(message) : undefined}
        accessibilityActions={
          !message.removed && !pending ? [{ name: 'activate', label: 'Message options' }] : []
        }
        onAccessibilityAction={() => onActions(message)}
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          message.kind === 'image' && styles.mediaBubble,
          pending && styles.dim,
        ]}
      >
        {content}
      </Pressable>
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
  mine: { backgroundColor: color.accent, borderBottomRightRadius: radius.s },
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
});

import { color, MIN_TOUCH_TARGET, space } from '@vyra/design-system';
import type { MessageView } from '@vyra/validation';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { ChatIcon } from './chat-icons';

function preview(message: MessageView): string {
  if (message.removed) return 'Message removed';
  if (message.body) return message.body;
  if (message.kind === 'image') return 'Photo';
  if (message.kind === 'voice') return 'Voice note';
  if (message.kind === 'date_plan') return message.plan?.idea ?? 'Date idea';
  return 'Message';
}

interface PinnedBannerProps {
  readonly messages: readonly MessageView[];
  readonly onPress: () => void;
}

/** A slim shelf for what both people agreed to keep close. */
export function PinnedBanner({ messages, onPress }: PinnedBannerProps) {
  const first = messages[0];
  if (!first) return null;

  return (
    <View style={styles.outer}>
      <Pressable
        role="button"
        aria-label={`${messages.length} pinned. Show pinned messages`}
        onPress={onPress}
        style={({ pressed }) => [styles.inner, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <ChatIcon name="pin" color={color.chemistryText} size={16} />
        </View>
        <View style={styles.copy}>
          <Text variant="eyebrow" tone="chemistryText">
            Pinned{messages.length > 1 ? ` · ${messages.length}` : ''}
          </Text>
          <Text variant="caption" tone="textSecondary" numberOfLines={1}>
            {preview(first)}
          </Text>
        </View>
        <ChatIcon name="chevronRight" color={color.textDisabled} size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: color.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  inner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space.l,
    paddingVertical: space.xs,
  },
  pressed: { backgroundColor: color.surface },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  copy: { flex: 1, gap: 1 },
});

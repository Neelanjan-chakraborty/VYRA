import { color, MIN_TOUCH_TARGET, space } from '@vyra/design-system';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import { PersonAvatar } from '@/features/discovery/person-avatar';
import { ChatIcon } from './chat-icons';

interface ChatHeaderProps {
  readonly name: string;
  readonly photoUrl: string | null;
  readonly city: string | null;
  readonly typing: boolean;
  readonly readOnly: boolean;
  readonly onBack: () => void;
  readonly onProfile: () => void;
  readonly onSettings: () => void;
}

/** Compact, sticky conversation header: identity, presence and one quiet menu. */
export function ChatHeader({
  name,
  photoUrl,
  city,
  typing,
  readOnly,
  onBack,
  onProfile,
  onSettings,
}: ChatHeaderProps) {
  const insets = useSafeAreaInsets();
  const subtitle = readOnly ? 'Connection ended' : typing ? 'typing…' : (city ?? ' ');

  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.s }]}>
      <View style={styles.inner}>
        <Pressable
          role="button"
          aria-label="Back"
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [styles.icon, pressed && styles.iconPressed]}
        >
          <ChatIcon name="back" color={color.textPrimary} />
        </Pressable>

        <Pressable
          role="link"
          aria-label={`${name}. View profile`}
          onPress={onProfile}
          style={styles.who}
        >
          <View style={styles.avatar}>
            <PersonAvatar name={name} photoUrl={photoUrl} size={40} round />
          </View>
          <View style={styles.copy}>
            <Text variant="titleSmall" numberOfLines={1} accessibilityRole="header">
              {name}
            </Text>
            <View style={styles.subtitleRow}>
              {!readOnly && !typing && city ? (
                <ChatIcon name="location" color={color.textSecondary} size={12} />
              ) : null}
              {typing && !readOnly ? <View style={styles.typingDot} aria-hidden /> : null}
              <Text
                variant="caption"
                tone={typing ? 'chemistryText' : 'textSecondary'}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          role="button"
          aria-label="Conversation settings"
          onPress={onSettings}
          hitSlop={10}
          style={({ pressed }) => [styles.icon, pressed && styles.iconPressed]}
        >
          <ChatIcon name="more" color={color.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
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
    gap: space.xs,
    paddingHorizontal: space.l,
    paddingBottom: space.s,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TOUCH_TARGET / 2,
  },
  iconPressed: { backgroundColor: color.surface },
  who: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: MIN_TOUCH_TARGET,
    paddingRight: space.s,
  },
  avatar: { borderRadius: 20, overflow: 'hidden' },
  copy: { flex: 1, gap: 1 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.chemistryText,
  },
});

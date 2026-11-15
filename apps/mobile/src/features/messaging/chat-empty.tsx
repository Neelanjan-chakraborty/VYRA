import { color, radius, space } from '@vyra/design-system';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { PersonAvatar } from '@/features/discovery/person-avatar';

const STARTERS = [
  'What’s been the best part of your week?',
  'A place you’d take someone new in the city.',
  'Coffee first, or a long walk?',
] as const;

interface ChatEmptyProps {
  readonly name: string;
  readonly photoUrl: string | null;
  readonly onStarter: (text: string) => void;
}

/** The first screen of a conversation: an invitation, not an empty box. */
export function ChatEmpty({ name, photoUrl, onStarter }: ChatEmptyProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.portrait}>
        <PersonAvatar name={name} photoUrl={photoUrl} size={64} round />
      </View>
      <Text variant="displayM" style={styles.title}>
        Say something worth remembering.
      </Text>
      <Text tone="textSecondary" style={styles.copy}>
        No need to be clever. Start with what caught your eye about {name}.
      </Text>
      <View style={styles.starters}>
        {STARTERS.map((starter) => (
          <Pressable
            key={starter}
            role="button"
            aria-label={`Use starter: ${starter}`}
            onPress={() => onStarter(starter)}
            style={({ pressed }) => [styles.starter, pressed && styles.starterPressed]}
          >
            <Text variant="captionStrong" tone="textPrimary">
              {starter}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
    gap: space.m,
  },
  portrait: { marginBottom: space.xs },
  title: { marginTop: space.xs },
  copy: { maxWidth: 380 },
  starters: { gap: space.s, marginTop: space.l },
  starter: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    borderRadius: radius.m,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  starterPressed: { backgroundColor: color.surfaceRaised },
});

import { color, radius, space } from '@vyra/design-system';
import type { MessageView, Reaction } from '@vyra/validation';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

interface ReactionBarProps {
  readonly message: MessageView;
  readonly canAct: boolean;
  readonly onReact: (message: MessageView, emoji: Reaction | null) => void;
}

/** Emoji sit on a slim shelf under the bubble; yours gets a quiet ring. */
export function ReactionBar({ message, canAct, onReact }: ReactionBarProps) {
  if (message.reactions.length === 0) return null;

  return (
    <View style={styles.bar} role="group" aria-label="Reactions">
      {message.reactions.map((reaction) => (
        <Pressable
          key={reaction.emoji}
          role="button"
          aria-label={`${reaction.emoji} ${reaction.count}${reaction.mine ? ', yours. Tap to remove' : ''}`}
          aria-selected={reaction.mine}
          disabled={!canAct}
          onPress={() => onReact(message, reaction.mine ? null : reaction.emoji)}
          style={({ pressed }) => [
            styles.chip,
            reaction.mine && styles.chipMine,
            pressed && styles.chipPressed,
          ]}
        >
          <Text variant="captionStrong">
            {reaction.emoji}
            {reaction.count > 1 ? ` ${reaction.count}` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xxs, marginTop: space.xxs },
  chip: {
    minHeight: 30,
    minWidth: 40,
    paddingHorizontal: space.s,
    borderRadius: radius.full,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipMine: { borderColor: color.chemistryText },
  chipPressed: { transform: [{ scale: 0.96 }] },
});

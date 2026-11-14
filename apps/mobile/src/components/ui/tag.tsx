import { color, radius, space } from '@vyra/design-system';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../text';

interface TagProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}

/** A compact multi-select choice. Squared, not a pill: selection inverts it. */
export function Tag({ label, selected, onPress }: TagProps) {
  return (
    <Pressable
      role="checkbox"
      aria-checked={selected}
      aria-label={label}
      onPress={onPress}
      hitSlop={4}
      style={[styles.tag, selected && styles.selected]}
    >
      <Text variant="caption" style={{ color: selected ? color.background : color.textPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.m,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: color.border,
  },
  selected: { backgroundColor: color.textPrimary, borderColor: color.textPrimary },
});

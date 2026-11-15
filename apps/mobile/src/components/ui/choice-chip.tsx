import { color, MIN_TOUCH_TARGET, radius, space } from '@vyra/design-system';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../text';

/** One choice in a short row of options (a radio group). */
export function ChoiceChip(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      role="radio"
      aria-checked={props.selected}
      aria-label={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.chip, props.selected && styles.on, props.disabled && styles.off]}
    >
      <Text variant="caption" tone={props.selected ? 'textPrimary' : 'textSecondary'}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: space.m,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { borderColor: color.accent, backgroundColor: color.surfaceRaised },
  off: { opacity: 0.4 },
});

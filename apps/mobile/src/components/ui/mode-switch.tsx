import { color, MIN_TOUCH_TARGET, radius, space } from '@vyra/design-system';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../text';

interface ModeSwitchProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}

/** A small set of mutually exclusive modes, side by side. */
export function ModeSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: ModeSwitchProps<T>) {
  return (
    <View role="radiogroup" aria-label={label} style={styles.root}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={selected}
            aria-label={`${label}: ${option.label}`}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text
              variant="caption"
              style={{ color: selected ? color.background : color.textPrimary }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.m,
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s,
    paddingHorizontal: space.s,
  },
  selected: { backgroundColor: color.textPrimary },
});

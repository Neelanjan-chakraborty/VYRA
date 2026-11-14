import { color, MIN_TOUCH_TARGET, radius, space } from '@vyra/design-system';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../text';

interface StepperProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <View
      style={styles.root}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <View style={styles.controls}>
        <StepButton
          symbol="−"
          label={`Decrease ${label}`}
          disabled={value <= min}
          onPress={() => step(-1)}
        />
        <Text variant="displayM" style={styles.value}>
          {value}
        </Text>
        <StepButton
          symbol="+"
          label={`Increase ${label}`}
          disabled={value >= max}
          onPress={() => step(1)}
        />
      </View>
    </View>
  );
}

function StepButton(props: {
  symbol: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-disabled={props.disabled}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && { backgroundColor: color.surfaceRaised },
        props.disabled && { opacity: 0.35 },
      ]}
    >
      <Text variant="title">{props.symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', marginTop: space.s },
  value: { minWidth: 52, textAlign: 'center' },
  button: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

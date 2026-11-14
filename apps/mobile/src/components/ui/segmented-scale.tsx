import { color, MIN_TOUCH_TARGET, radius, space } from '@vyra/design-system';
import { SCALE_STEPS } from '@vyra/validation';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../text';

interface SegmentedScaleProps {
  readonly label: string;
  readonly low: string;
  readonly high: string;
  readonly value: number | null;
  readonly onChange: (value: number) => void;
}

/** A five-step choice between two described ends. Discrete on purpose: it is not a measurement. */
export function SegmentedScale({ label, low, high, value, onChange }: SegmentedScaleProps) {
  const stepLabel = (index: number) =>
    ['Strongly: ' + low, 'Leaning: ' + low, 'In between', 'Leaning: ' + high, 'Strongly: ' + high][
      index
    ] ?? '';
  return (
    <View role="radiogroup" aria-label={label}>
      <View style={styles.segments}>
        {SCALE_STEPS.map((step, index) => {
          const selected = value !== null && Math.abs(value - step) < 0.13;
          return (
            <Pressable
              key={step}
              role="radio"
              aria-checked={selected}
              aria-label={stepLabel(index)}
              onPress={() => onChange(step)}
              style={[styles.segment, selected && styles.selected]}
            />
          );
        })}
      </View>
      <View style={styles.ends}>
        <Text variant="caption" tone="textSecondary" style={styles.end}>
          {low}
        </Text>
        <Text variant="caption" tone="textSecondary" style={[styles.end, styles.right]}>
          {high}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: space.xs },
  segment: {
    flex: 1,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  selected: { backgroundColor: color.textPrimary, borderColor: color.textPrimary },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.s, gap: space.l },
  end: { flex: 1 },
  right: { textAlign: 'right' },
});

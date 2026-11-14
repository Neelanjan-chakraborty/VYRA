import { color, MIN_TOUCH_TARGET } from '@vyra/design-system';
import { Pressable, StyleSheet, View } from 'react-native';

interface ToggleProps {
  readonly label: string;
  readonly value: boolean;
  readonly disabled?: boolean;
  readonly onChange: (value: boolean) => void;
}

/** On/off switch in VYRA's own colours on every platform. */
export function Toggle({ label, value, disabled = false, onChange }: ToggleProps) {
  return (
    <Pressable
      role="switch"
      aria-label={label}
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={[styles.hit, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: color.textSecondary,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: color.textPrimary, borderColor: color.textPrimary },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: color.textSecondary },
  thumbOn: { backgroundColor: color.background, alignSelf: 'flex-end' },
});

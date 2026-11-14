import { color, MIN_TOUCH_TARGET, radius, space, typography } from '@vyra/design-system';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { Text } from '../text';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  readonly label: string;
  readonly variant?: Variant;
  readonly loading?: boolean;
  readonly style?: ViewStyle;
}

const FILL: Record<Variant, { rest: string; pressed: string; text: string; border?: string }> = {
  // The one accent-filled control a screen may have.
  primary: { rest: color.accent, pressed: color.accentPressed, text: color.textOnAccent },
  secondary: {
    rest: 'transparent',
    pressed: color.surfaceRaised,
    text: color.textPrimary,
    border: color.border,
  },
  quiet: { rest: 'transparent', pressed: color.surface, text: color.textSecondary },
  danger: {
    rest: 'transparent',
    pressed: color.surfaceRaised,
    text: color.danger,
    border: color.danger,
  },
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const palette = FILL[variant];
  const inactive = disabled === true || loading;
  return (
    <Pressable
      {...rest}
      role="button"
      aria-label={label}
      aria-disabled={inactive}
      aria-busy={loading}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? palette.pressed : palette.rest },
        palette.border !== undefined && { borderWidth: 1, borderColor: palette.border },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[typography.bodyStrong, { color: palette.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET + space.s,
    paddingHorizontal: space.xl,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { opacity: 0.45 },
});

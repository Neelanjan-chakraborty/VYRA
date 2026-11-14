import { color, radius, typography } from '@vyra/design-system';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from '../text';

/**
 * Neutral stand-in when someone has no approved photo. Shows an initial, never
 * a generic face or anything that could be mistaken for the person.
 */
export function PhotoPlaceholder({
  name,
  style,
}: {
  readonly name: string;
  readonly style?: ViewStyle;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '·';
  return (
    <View style={[styles.root, style]} aria-label={`No photo of ${name} yet`} role="img">
      <Text style={styles.initial}>{initial}</Text>
      <Text variant="caption" tone="textSecondary" style={styles.caption}>
        No photo yet
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  initial: { ...typography.displayXL, color: color.textSecondary },
  caption: { marginTop: 4 },
});

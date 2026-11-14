import { color, radius, space } from '@vyra/design-system';
import { StyleSheet, View } from 'react-native';
import { Text } from '../text';

/** Inline message for a failed action. Announced to screen readers when it appears. */
export function ErrorNotice({ message }: { readonly message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View style={styles.error} role="alert">
      <Text variant="caption" tone="danger">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    borderLeftWidth: 2,
    borderLeftColor: color.danger,
    paddingLeft: space.m,
    paddingVertical: space.xs,
    marginBottom: space.l,
    borderRadius: radius.none,
  },
});

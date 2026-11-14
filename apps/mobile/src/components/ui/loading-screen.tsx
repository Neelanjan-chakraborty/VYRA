import { color } from '@vyra/design-system';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function LoadingScreen({ label = 'Loading' }: { readonly label?: string }) {
  return (
    <View style={styles.root} role="status" aria-label={label} aria-busy>
      <ActivityIndicator color={color.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { space } from '@vyra/design-system';
import { StyleSheet, View } from 'react-native';
import { OrbitMotif } from '@/components/orbit-motif';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';

export default function OrbitScreen() {
  return (
    <Screen eyebrow="Orbit" title="Your orbit is still empty.">
      <Text tone="textSecondary">
        People appear here once VYRA understands you. The closer someone sits to your centre, the
        more aligned you are estimated to be.
      </Text>
      <View
        style={styles.motif}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <OrbitMotif />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Offset from centre on purpose: the composition leans, like an orbit does.
  motif: { marginTop: space.xl, alignItems: 'flex-end', marginRight: -space.xl },
});

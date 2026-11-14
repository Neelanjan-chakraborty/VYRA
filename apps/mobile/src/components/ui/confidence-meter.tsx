import { color, radius, space } from '@vyra/design-system';
import { StyleSheet, View } from 'react-native';
import { confidenceLabel } from '@/features/persona/format';
import { Text } from '../text';

/** Confidence as words and three ticks. The words carry the meaning; the ticks only echo it. */
export function ConfidenceMeter({ confidence }: { readonly confidence: number }) {
  const label = confidenceLabel(confidence);
  const filled = label === 'High' ? 3 : label === 'Medium' ? 2 : 1;
  return (
    <View style={styles.root} aria-label={`${label} confidence`}>
      <View style={styles.ticks} aria-hidden>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.tick, i < filled && styles.filled]} />
        ))}
      </View>
      <Text variant="caption" tone="textSecondary">
        {label} confidence
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  ticks: { flexDirection: 'row', gap: 3 },
  tick: { width: 10, height: 4, borderRadius: radius.s, backgroundColor: color.border },
  filled: { backgroundColor: color.textSecondary },
});

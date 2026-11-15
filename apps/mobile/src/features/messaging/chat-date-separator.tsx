import { color, space } from '@vyra/design-system';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { dayLabel } from './chat-timeline';

/** A calm rule with the day in small caps. */
export function ChatDateSeparator({ iso }: { readonly iso: string }) {
  const label = dayLabel(iso);
  return (
    <View style={styles.row} aria-label={label}>
      <View style={styles.rule} aria-hidden />
      <Text variant="eyebrow" tone="textSecondary">
        {label}
      </Text>
      <View style={styles.rule} aria-hidden />
    </View>
  );
}

/** Marks the first message that arrived after the reader scrolled away. */
export function ChatNewSeparator() {
  return (
    <View style={styles.row} aria-label="New message">
      <View style={styles.newRule} aria-hidden />
      <Text variant="eyebrow" tone="chemistryText">
        New message
      </Text>
      <View style={styles.newRule} aria-hidden />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginTop: space.xl,
    marginBottom: space.s,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.border },
  newRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.chemistry },
});

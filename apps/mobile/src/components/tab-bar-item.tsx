import { color, MIN_TOUCH_TARGET, space } from '@vyra/design-system';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { TabIcon, type TabIconName } from './tab-icons';
import { Text } from './text';

// expo-router types `ref` against the View component rather than its instance, which
// conflicts with Pressable's ref type; the ref still passes through at runtime.
interface TabBarItemProps extends Omit<TabTriggerSlotProps, 'ref'> {
  readonly icon: TabIconName;
  readonly label: string;
  /** Something new here. A dot, never a count. */
  readonly dot?: boolean;
}

/** One destination in the tab bar. Rendered through `TabTrigger asChild`. */
export function TabBarItem({
  icon,
  label,
  dot = false,
  isFocused = false,
  ...pressableProps
}: TabBarItemProps) {
  const tint = isFocused ? color.textPrimary : color.textSecondary;
  return (
    <Pressable
      {...pressableProps}
      role="tab"
      aria-label={dot ? `${label}, something new` : label}
      aria-selected={isFocused}
      style={styles.item}
    >
      <View>
        <TabIcon name={icon} color={tint} />
        {dot ? <View style={styles.dot} /> : null}
      </View>
      <Text variant="caption" style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      {/* The single accent on the bar marks where you are. */}
      <View style={[styles.marker, isFocused && styles.markerActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 10pt keeps "Connections" on one line at 320pt wide.
  label: { fontSize: 10, lineHeight: 14, letterSpacing: 0, marginTop: space.xs },
  marker: { width: 4, height: 4, borderRadius: 2, marginTop: space.xs },
  markerActive: { backgroundColor: color.accent },
  dot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.chemistryText,
  },
});

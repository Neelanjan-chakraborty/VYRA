import { color, space } from '@vyra/design-system';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';

/** Height reserved for the floating tab bar, excluding the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 64;
const MAX_CONTENT_WIDTH = 560;

interface ScreenProps {
  readonly eyebrow: string;
  readonly title: string;
  /** Sits at the right of the eyebrow line, e.g. a search button. */
  readonly action?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * Standard tab screen: safe-area aware, scrollable so large text sizes never
 * clip, with the editorial eyebrow + serif title header.
 */
export function Screen({ eyebrow, title, action, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    // The scroll view is pinned to its frame so it always scrolls internally.
    // Inside expo-router's tab slot on web the screen wrapper grows with its
    // content instead, which made the page scroll under the tab bar.
    <View style={styles.frame}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.xxl,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + space.xxl,
          },
        ]}
      >
        <View style={styles.column}>
          <View style={styles.eyebrowRow}>
            <Text variant="eyebrow" tone="textSecondary" accessibilityRole="header">
              {eyebrow}
            </Text>
            {action}
          </View>
          <Text variant="displayL" style={styles.title}>
            {title}
          </Text>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: color.background },
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  content: { flexGrow: 1, paddingHorizontal: space.xl },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: space.m, marginBottom: space.xl },
});

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
  readonly children?: ReactNode;
}

/**
 * Standard tab screen: safe-area aware, scrollable so large text sizes never
 * clip, with the editorial eyebrow + serif title header.
 */
export function Screen({ eyebrow, title, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
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
        <Text variant="eyebrow" tone="textSecondary" accessibilityRole="header">
          {eyebrow}
        </Text>
        <Text variant="displayL" style={styles.title}>
          {title}
        </Text>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  content: { flexGrow: 1, paddingHorizontal: space.xl },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  title: { marginTop: space.m, marginBottom: space.xl },
});

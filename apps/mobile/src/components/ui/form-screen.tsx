import { color, space } from '@vyra/design-system';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../text';

interface FormScreenProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly intro?: string;
  readonly children?: ReactNode;
  /** Pinned above the keyboard: the screen's actions. */
  readonly footer?: ReactNode;
  /** Show a back control. Default true; pass false on the first screen of a flow. */
  readonly showBack?: boolean;
  /** 0–1: draws a progress line under the header. */
  readonly progress?: number;
  /** Right-aligned header action, e.g. Skip. */
  readonly headerAction?: ReactNode;
}

/**
 * Layout for every form and step: scrollable content, actions pinned to the
 * bottom, and correct behaviour with the keyboard open and with large text.
 */
export function FormScreen(props: FormScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canGoBack = props.showBack ?? true;

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
        <View style={styles.headerRow}>
          {canGoBack ? (
            <Pressable
              role="button"
              aria-label="Back"
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.back}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path
                  d="M14.5 5.5L8 12l6.5 6.5"
                  stroke={color.textPrimary}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          {props.headerAction}
        </View>
        {props.progress !== undefined ? (
          <View
            style={styles.track}
            role="progressbar"
            aria-label="Setup progress"
            aria-valuenow={Math.round(props.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <View style={[styles.fill, { width: `${Math.round(props.progress * 100)}%` }]} />
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          {props.eyebrow ? (
            <Text variant="eyebrow" tone="textSecondary">
              {props.eyebrow}
            </Text>
          ) : null}
          <Text variant="displayL" style={styles.title} accessibilityRole="header">
            {props.title}
          </Text>
          {props.intro ? (
            <Text tone="textSecondary" style={styles.intro}>
              {props.intro}
            </Text>
          ) : null}
          {props.children}
        </View>
      </ScrollView>

      {props.footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.l }]}>
          <View style={styles.column}>{props.footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  header: { paddingHorizontal: space.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -space.s },
  track: { height: 2, backgroundColor: color.border, marginTop: space.s },
  fill: { height: 2, backgroundColor: color.textPrimary },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { marginTop: space.m, marginBottom: space.l },
  intro: { marginBottom: space.xl },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: color.background,
    gap: space.m,
  },
});

import { color, easing, radius, resolveDuration, space } from '@vyra/design-system';
import { type ReactNode, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../text';

interface BottomSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** Modal sheet for a focused decision. Slides up; fades only under reduced motion. */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: resolveDuration('base', reduceMotion),
      easing: Easing.bezier(...easing.standard),
    });
  }, [visible, progress, reduceMotion]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * 48 }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} aria-label="Close" role="button" />
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }, sheetStyle]}
          role="dialog"
          aria-modal
          aria-label={title}
        >
          <View style={styles.handle} aria-hidden />
          <Text variant="displayM" style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: color.scrim,
  },
  sheet: {
    backgroundColor: color.surfaceRaised,
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    paddingHorizontal: space.xl,
    paddingTop: space.m,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
    marginBottom: space.l,
  },
  title: { marginBottom: space.m },
});

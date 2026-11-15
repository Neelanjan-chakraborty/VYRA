import { color, radius, space } from '@vyra/design-system';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const ROWS = [
  { mine: false, width: 190, height: 44 },
  { mine: false, width: 132, height: 38 },
  { mine: true, width: 210, height: 48 },
  { mine: false, width: 164, height: 40 },
  { mine: true, width: 118, height: 38 },
  { mine: false, width: 226, height: 52 },
  { mine: true, width: 176, height: 42 },
] as const;

/** A quiet placeholder shaped like the conversation it is about to become. */
export function ChatSkeleton() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0.42);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.55;
      return;
    }
    pulse.value = withRepeat(withTiming(0.82, { duration: 900 }), -1, true);
  }, [pulse, reduceMotion]);

  const glow = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.root} aria-label="Loading messages" aria-busy>
      <Animated.View style={[styles.stack, glow]}>
        {ROWS.map((row, index) => (
          <View
            key={index}
            style={[
              styles.row,
              row.mine ? styles.rowMine : styles.rowTheirs,
              { width: row.width, height: row.height },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.l, paddingVertical: space.l },
  stack: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: space.m,
    flex: 1,
    justifyContent: 'flex-end',
  },
  row: { backgroundColor: color.surfaceRaised, borderRadius: radius.l },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', marginLeft: 32 },
});

import { color, easing, MIN_TOUCH_TARGET, resolveDuration, space } from '@vyra/design-system';
import type { Recommendation } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { alignmentWords } from './discovery-api';
import { layoutOrbit } from './orbit-layout';
import { PersonAvatar } from './person-avatar';

const NODE = MIN_TOUCH_TARGET;
/** Room reserved around each node so names don't collide. */
const NODE_FOOTPRINT = NODE + space.l;
const MAX_SCALE = 2.4;

function clamp(value: number, low: number, high: number): number {
  'worklet';
  return Math.min(high, Math.max(low, value));
}

/**
 * People around you, closer the more aligned you're estimated to be. Pan and
 * pinch to look around; the buttons do the same for anyone who can't gesture.
 */
export function OrbitCanvas({
  people,
  size,
}: {
  readonly people: readonly Recommendation[];
  readonly size: number;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const geometry = useMemo(
    () =>
      layoutOrbit(
        people.map((p) => ({ id: p.userId, overall: p.overall })),
        size,
        NODE_FOOTPRINT,
      ),
    [people, size],
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.userId, p])), [people]);

  // The drawing is normally the viewport's size; a crowded orbit spills wider and starts
  // zoomed out just enough to show everyone.
  // Names hang below the outermost nodes, so leave room for them too.
  const content = (geometry.extent + space.l) * 2;
  const fit = Math.min(1, size / content);
  const minScale = Math.min(0.7, fit);
  const scale = useSharedValue(fit);
  const savedScale = useSharedValue(fit);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const limit = content / 2;

  const pan = usePanGesture({
    minDistance: 8,
    onUpdate: (event) => {
      'worklet';
      x.value = clamp(savedX.value + event.translationX, -limit, limit);
      y.value = clamp(savedY.value + event.translationY, -limit, limit);
    },
    onDeactivate: () => {
      'worklet';
      savedX.value = x.value;
      savedY.value = y.value;
    },
  });
  const pinch = usePinchGesture({
    onUpdate: (event) => {
      'worklet';
      scale.value = clamp(savedScale.value * event.scale, minScale, MAX_SCALE);
    },
    onDeactivate: () => {
      'worklet';
      savedScale.value = scale.value;
    },
  });
  const gesture = useSimultaneousGestures(pan, pinch);

  const animate = (value: number) =>
    reduceMotion
      ? value
      : withTiming(value, {
          duration: resolveDuration('base', reduceMotion),
          easing: Easing.bezier(...easing.standard),
        });
  const zoomTo = (next: number) => {
    const target = clamp(next, minScale, MAX_SCALE);
    savedScale.value = target;
    scale.value = animate(target);
  };
  const reset = () => {
    savedScale.value = fit;
    savedX.value = 0;
    savedY.value = 0;
    scale.value = animate(fit);
    x.value = animate(0);
    y.value = animate(0);
  };

  // New people can change how much room the orbit needs.
  useEffect(() => {
    savedScale.value = fit;
    scale.value = fit;
  }, [fit, savedScale, scale]);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const centre = content / 2;
  const offset = (size - content) / 2;
  const outerRing = geometry.rings.length - 1;

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View style={[styles.viewport, { width: size, height: size }]}>
          <Animated.View
            style={[
              { position: 'absolute', left: offset, top: offset, width: content, height: content },
              canvasStyle,
            ]}
          >
            <Svg
              width={content}
              height={content}
              style={StyleSheet.absoluteFill}
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {geometry.rings.map((r, index) => (
                <Circle
                  key={r}
                  cx={centre}
                  cy={centre}
                  r={r}
                  stroke={color.border}
                  strokeWidth={1}
                  strokeDasharray={index === outerRing ? '2 7' : undefined}
                  fill="none"
                />
              ))}
              <Circle cx={centre} cy={centre} r={5} fill={color.textPrimary} />
              <Circle cx={centre} cy={centre} r={13} stroke={color.accent} fill="none" />
            </Svg>
            {/* Most aligned first, so screen readers meet people in order of estimated alignment. */}
            {geometry.nodes.map((node) => {
              const person = byId.get(node.id);
              if (!person) return null;
              return (
                <Pressable
                  key={node.id}
                  role="link"
                  aria-label={`${person.displayName}, ${person.age}. ${alignmentWords(person.overall)}. Open profile`}
                  onPress={() => router.push(`/person/${person.userId}`)}
                  style={({ pressed }) => [
                    styles.node,
                    {
                      left: centre + node.x - NODE_FOOTPRINT / 2,
                      top: centre + node.y - NODE / 2,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={[styles.ring, node.ring === 0 && styles.ringStrong]}>
                    <PersonAvatar
                      name={person.displayName}
                      photoUrl={person.photoUrl}
                      size={NODE - 4}
                      round
                    />
                  </View>
                  <Text variant="caption" numberOfLines={1} style={styles.name}>
                    {person.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.controls}>
        <Button label="Zoom out" variant="quiet" onPress={() => zoomTo(savedScale.value / 1.3)} />
        <Button label="Re-centre" variant="quiet" onPress={reset} />
        <Button label="Zoom in" variant="quiet" onPress={() => zoomTo(savedScale.value * 1.3)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden', alignSelf: 'center' },
  node: { position: 'absolute', width: NODE_FOOTPRINT, alignItems: 'center' },
  ring: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringStrong: { borderColor: color.chemistryText },
  name: { marginTop: space.xxs, maxWidth: NODE_FOOTPRINT + space.l, textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: space.s },
});

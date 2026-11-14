import { color, space } from '@vyra/design-system';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrbitMotif } from '@/components/orbit-motif';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { useAuthFlow } from '@/features/auth/auth-flow';

// Reanimated's entering animations follow the system reduced-motion setting by default.
const rise = (delay: number) => FadeInDown.delay(delay).duration(520);

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const update = useAuthFlow((state) => state.update);

  function start(channel: 'phone' | 'email') {
    update({ channel, destination: '', challengeId: null, devCode: null });
    router.push('/sign-in');
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <Animated.View entering={FadeIn.duration(900)} style={styles.motif} aria-hidden>
        <OrbitMotif size={340} />
      </Animated.View>

      <View style={styles.copy}>
        <Animated.View entering={rise(150)}>
          <Text variant="displayXL" accessibilityRole="header">
            VYRA
          </Text>
        </Animated.View>
        <Animated.View entering={rise(300)}>
          <Text variant="displayM" tone="textSecondary" style={styles.tagline}>
            Chemistry, decoded.
          </Text>
        </Animated.View>
        <Animated.View entering={rise(450)}>
          <Text tone="textSecondary" style={styles.lede}>
            We work out who you might connect with, and why, before we show you anyone.
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={rise(600)} style={styles.actions}>
        <Button label="Continue with phone" onPress={() => start('phone')} />
        <Button label="Continue with e-mail" variant="secondary" onPress={() => start('email')} />
        <Text variant="caption" tone="textSecondary" style={styles.legal}>
          For adults aged 18 and over.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background, paddingHorizontal: space.xl },
  // Bleeds off the top-right edge: the composition is deliberately off-centre.
  motif: { position: 'absolute', top: 24, right: -110 },
  copy: { flex: 1, justifyContent: 'flex-end', maxWidth: 560, width: '100%', alignSelf: 'center' },
  tagline: { marginTop: space.xs },
  lede: { marginTop: space.l, maxWidth: 320 },
  actions: {
    marginTop: space.xxl,
    gap: space.m,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  legal: { textAlign: 'center', marginTop: space.xs },
});

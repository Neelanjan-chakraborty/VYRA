import { color, MIN_TOUCH_TARGET } from '@vyra/design-system';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { TabIcon } from './tab-icons';

/** Opens people search. Lives in the header of the tabs where you look for people. */
export function SearchButton() {
  const router = useRouter();
  return (
    <Pressable
      role="button"
      aria-label="Search people"
      onPress={() => router.push('/search')}
      hitSlop={8}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <TabIcon name="search" color={color.textPrimary} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});

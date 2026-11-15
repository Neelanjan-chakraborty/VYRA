import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { color } from '@vyra/design-system';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { useMe } from '@/features/profile/profile-api';
import { useResolveUsername } from '@/features/search/search-api';

/**
 * Where a scanned QR code or shared link lands (vyra://u/name). Finds the
 * person and opens their profile; if they can't be shown, it says so without
 * saying why, exactly as a hidden profile does anywhere else.
 */
export default function OpenSharedProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const mine = useMe().data?.profile?.username ?? null;
  const own = mine !== null && mine === String(username).toLowerCase().replace(/^@/, '');
  const resolved = useResolveUsername(own ? '' : String(username ?? ''));

  useEffect(() => {
    if (own) router.replace('/(tabs)/you');
    else if (resolved.data) router.replace(`/person/${resolved.data.userId}`);
  }, [own, resolved.data, router]);

  if (resolved.isError) {
    return (
      <FormScreen
        eyebrow="Profile"
        title="This profile isn’t available."
        intro="It may not exist, or it isn’t something you can see."
        footer={
          <Button label="Back" variant="secondary" onPress={() => router.replace('/(tabs)')} />
        }
      />
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator color={color.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background,
  },
});

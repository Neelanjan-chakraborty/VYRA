import { color, space } from '@vyra/design-system';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';
import { signOut } from './auth-api';

/** Shown when a signed-in person's account cannot be loaded (offline, server down). */
export function AccountUnavailable() {
  const me = useMe();
  return (
    <View style={styles.root}>
      <Text variant="eyebrow" tone="textSecondary">
        Connection
      </Text>
      <Text variant="displayL" style={styles.title} accessibilityRole="header">
        We can’t reach your account.
      </Text>
      <Text tone="textSecondary" style={styles.body}>
        {errorMessage(me.error)}
      </Text>
      <Button label="Try again" loading={me.isFetching} onPress={() => void me.refetch()} />
      <Button
        label="Sign out"
        variant="quiet"
        onPress={() => void signOut()}
        style={styles.second}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background, justifyContent: 'center', padding: space.xl },
  title: { marginTop: space.m, marginBottom: space.l },
  body: { marginBottom: space.xxl },
  second: { marginTop: space.m },
});

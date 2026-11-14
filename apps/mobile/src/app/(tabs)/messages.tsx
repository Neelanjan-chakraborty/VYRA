import { space } from '@vyra/design-system';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { useConnections } from '@/features/discovery/discovery-api';

export default function MessagesScreen() {
  const router = useRouter();
  const mutual = useConnections().data?.mutual.length ?? 0;
  return (
    <Screen eyebrow="Messages" title="No conversations yet.">
      <Text tone="textSecondary">
        {mutual > 0
          ? 'You have mutual connections. Messaging arrives in the next release; until then they’re kept in Connections.'
          : 'A conversation opens when a connection is mutual. Until then, there is nothing to say.'}
      </Text>
      {mutual > 0 ? (
        <Button
          label="See mutual connections"
          variant="secondary"
          onPress={() => router.push('/(tabs)/connections')}
          style={{ alignSelf: 'flex-start', marginTop: space.xl }}
        />
      ) : null}
    </Screen>
  );
}

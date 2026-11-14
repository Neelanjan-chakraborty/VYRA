import { Screen } from '@/components/screen';
import { Text } from '@/components/text';

export default function ConnectionsScreen() {
  return (
    <Screen eyebrow="Connections" title="No requests yet.">
      <Text tone="textSecondary">
        Requests you send and receive, people you have saved, and mutual connections will be kept
        here.
      </Text>
    </Screen>
  );
}

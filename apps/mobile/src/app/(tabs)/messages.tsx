import { Screen } from '@/components/screen';
import { Text } from '@/components/text';

export default function MessagesScreen() {
  return (
    <Screen eyebrow="Messages" title="No conversations yet.">
      <Text tone="textSecondary">
        A conversation opens when a connection is mutual. Until then, there is nothing to say.
      </Text>
    </Screen>
  );
}

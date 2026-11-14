import { Screen } from '@/components/screen';
import { Text } from '@/components/text';

export default function DiscoverScreen() {
  return (
    <Screen eyebrow="Discover" title="Read people, don’t flick past them.">
      <Text tone="textSecondary">
        Full profiles will open here — who someone is, what you share, and where you differ. Nothing
        to read yet.
      </Text>
    </Screen>
  );
}

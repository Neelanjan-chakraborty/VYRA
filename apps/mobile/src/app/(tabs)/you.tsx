import { Screen } from '@/components/screen';
import { ServiceStatus } from '@/components/service-status';
import { Text } from '@/components/text';

export default function YouScreen() {
  return (
    <Screen eyebrow="You" title="You haven’t been introduced.">
      <Text tone="textSecondary">
        Your profile, persona and privacy controls will live here once you have an account.
      </Text>
      {__DEV__ && <ServiceStatus />}
    </Screen>
  );
}

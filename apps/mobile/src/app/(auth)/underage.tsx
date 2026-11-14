import { MINIMUM_AGE_YEARS } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { useAuthFlow } from '@/features/auth/auth-flow';

export default function UnderageScreen() {
  const router = useRouter();
  const reset = useAuthFlow((state) => state.reset);
  // Discard the verification so it cannot be reused with a different date.
  useEffect(reset, [reset]);
  return (
    <FormScreen
      showBack={false}
      eyebrow="Not yet"
      title={`VYRA is for people aged ${MINIMUM_AGE_YEARS} and over.`}
      intro="We haven’t created an account or kept your details."
      footer={<Button label="Close" variant="secondary" onPress={() => router.dismissTo('/')} />}
    >
      {null}
    </FormScreen>
  );
}

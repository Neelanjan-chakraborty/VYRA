import { space } from '@vyra/design-system';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { register } from '@/features/auth/auth-api';
import { useAuthFlow } from '@/features/auth/auth-flow';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

const COMMITMENTS = [
  'Every AI feature is optional and asks first.',
  'You see, edit and approve anything VYRA infers about you.',
  'Nothing is ever sent in your name without you pressing send.',
  'You can delete your account and data at any time.',
];

export default function ConsentScreen() {
  const router = useRouter();
  const { registrationToken, dateOfBirth, reset } = useAuthFlow();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!registrationToken || !dateOfBirth) router.dismissTo('/');
  }, [registrationToken, dateOfBirth, router]);

  async function submit() {
    if (!registrationToken || !dateOfBirth) return;
    setBusy(true);
    setError(undefined);
    try {
      const tokens = await register(registrationToken, dateOfBirth);
      await useSession.getState().setTokens(tokens);
      reset();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <FormScreen
      eyebrow="Before you start"
      title="How VYRA treats you."
      footer={
        <Button
          label="Agree and create account"
          loading={busy}
          disabled={!terms || !privacy}
          onPress={() => void submit()}
        />
      }
    >
      <ErrorNotice message={error} />
      <View style={styles.list}>
        {COMMITMENTS.map((line) => (
          <View key={line} style={styles.item}>
            <Text tone="textSecondary" style={styles.dash}>
              —
            </Text>
            <Text style={styles.line}>{line}</Text>
          </View>
        ))}
      </View>
      <SelectRow
        label="I agree to the Terms of Service"
        selected={terms}
        onPress={() => setTerms((v) => !v)}
      />
      <SelectRow
        label="I agree to the Privacy Policy"
        description="Including how my profile is used to suggest people to me."
        selected={privacy}
        onPress={() => setPrivacy((v) => !v)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: { marginBottom: space.xl, gap: space.m },
  item: { flexDirection: 'row' },
  dash: { width: space.xl },
  line: { flex: 1 },
});

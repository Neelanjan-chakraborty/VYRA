import { space } from '@vyra/design-system';
import { OTP_LENGTH } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { OtpInput } from '@/components/ui/otp-input';
import { requestCode, verifyCode } from '@/features/auth/auth-api';
import { useAuthFlow } from '@/features/auth/auth-flow';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { channel, destination, challengeId, devCode, update } = useAuthFlow();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Arriving here without a pending challenge (e.g. after a reload) restarts the flow.
  useEffect(() => {
    if (!challengeId) router.dismissTo('/');
  }, [challengeId, router]);

  async function submit(value: string) {
    if (!challengeId || value.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await verifyCode({ channel, destination, challengeId, code: value });
      if (result.status === 'authenticated') {
        await useSession.getState().setTokens(result.tokens);
      } else {
        // The challenge id is left in place: clearing it here would trip the guard
        // above and race the navigation below. It is already spent on the server.
        update({ registrationToken: result.registrationToken, devCode: null });
        router.replace('/age');
      }
    } catch (failure) {
      setError(errorMessage(failure));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(undefined);
    setCode('');
    try {
      const response = await requestCode(channel, destination);
      update({ challengeId: response.challengeId, devCode: response.devCode ?? null });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <FormScreen
      eyebrow="Verification"
      title="Enter the code."
      intro={`Sent to ${destination}. It expires in ten minutes.`}
      footer={
        <>
          <Button
            label="Verify"
            loading={busy}
            disabled={code.length !== OTP_LENGTH}
            onPress={() => void submit(code)}
          />
          <Button
            label={cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
            variant="quiet"
            disabled={cooldown > 0}
            onPress={() => void resend()}
          />
        </>
      }
    >
      <ErrorNotice message={error} />
      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={(value) => void submit(value)}
        hasError={error !== undefined}
        disabled={busy}
      />
      {devCode ? (
        <View style={styles.dev}>
          <Text variant="eyebrow" tone="textSecondary">
            Development build
          </Text>
          <Text variant="caption" tone="textSecondary" style={styles.devLine}>
            No message was sent. Your code is {devCode}.
          </Text>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  dev: { marginTop: space.xxl },
  devLine: { marginTop: space.xs },
});

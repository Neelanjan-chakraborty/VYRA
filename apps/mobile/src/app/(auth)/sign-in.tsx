import { emailSchema, phoneSchema } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { requestCode } from '@/features/auth/auth-api';
import { useAuthFlow } from '@/features/auth/auth-flow';
import { ApiRequestError, errorMessage } from '@/lib/api';

export default function SignInScreen() {
  const router = useRouter();
  const { channel, update } = useAuthFlow();
  const isPhone = channel === 'phone';
  // India-first: the dial code is pre-filled and can be replaced.
  const [value, setValue] = useState(isPhone ? '+91 ' : '');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFormError(undefined);
    const parsed = (isPhone ? phoneSchema : emailSchema).safeParse(value);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Check this and try again');
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    try {
      const response = await requestCode(channel, parsed.data);
      update({
        destination: parsed.data,
        challengeId: response.challengeId,
        devCode: response.devCode ?? null,
      });
      router.push('/verify');
    } catch (error) {
      const serverField =
        error instanceof ApiRequestError ? error.fieldError('destination') : undefined;
      if (serverField) setFieldError(serverField);
      else setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen
      eyebrow="Sign in or join"
      title={isPhone ? 'What’s your number?' : 'What’s your e-mail?'}
      intro="We’ll send a one-time code. No passwords."
      footer={<Button label="Send code" loading={busy} onPress={() => void submit()} />}
    >
      <ErrorNotice message={formError} />
      <TextField
        label={isPhone ? 'Phone number' : 'E-mail address'}
        value={value}
        onChangeText={setValue}
        error={fieldError}
        hint={isPhone ? 'Include the country code.' : undefined}
        autoFocus
        inputMode={isPhone ? 'tel' : 'email'}
        keyboardType={isPhone ? 'phone-pad' : 'email-address'}
        autoComplete={isPhone ? 'tel' : 'email'}
        textContentType={isPhone ? 'telephoneNumber' : 'emailAddress'}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
      />
    </FormScreen>
  );
}

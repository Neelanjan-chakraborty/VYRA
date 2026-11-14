import { space } from '@vyra/design-system';
import { ageInYears, dateOfBirthSchema, MINIMUM_AGE_YEARS } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { useAuthFlow } from '@/features/auth/auth-flow';

const digits = (text: string, max: number) => text.replaceAll(/\D/g, '').slice(0, max);

export default function AgeScreen() {
  const router = useRouter();
  const { registrationToken, update } = useAuthFlow();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!registrationToken) router.dismissTo('/');
  }, [registrationToken, router]);

  function submit() {
    const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = dateOfBirthSchema.safeParse(iso);
    if (!parsed.success) {
      setError('Enter your date of birth as day, month and year.');
      return;
    }
    if (ageInYears(parsed.data) < MINIMUM_AGE_YEARS) {
      // Nothing is sent to the server for anyone under the minimum age.
      // The next screen discards the registration token.
      router.replace('/underage');
      return;
    }
    update({ dateOfBirth: parsed.data });
    router.push('/consent');
  }

  return (
    <FormScreen
      showBack={false}
      eyebrow="Your age"
      title="When were you born?"
      intro="VYRA is for adults. Your age is shown on your profile; your date of birth never is."
      footer={<Button label="Continue" onPress={submit} />}
    >
      <ErrorNotice message={error} />
      <View style={styles.row}>
        <View style={styles.small}>
          <TextField
            label="Day"
            value={day}
            onChangeText={(t) => setDay(digits(t, 2))}
            placeholder="DD"
            inputMode="numeric"
            keyboardType="number-pad"
            autoComplete="birthdate-day"
            autoFocus
          />
        </View>
        <View style={styles.small}>
          <TextField
            label="Month"
            value={month}
            onChangeText={(t) => setMonth(digits(t, 2))}
            placeholder="MM"
            inputMode="numeric"
            keyboardType="number-pad"
            autoComplete="birthdate-month"
          />
        </View>
        <View style={styles.large}>
          <TextField
            label="Year"
            value={year}
            onChangeText={(t) => setYear(digits(t, 4))}
            placeholder="YYYY"
            inputMode="numeric"
            keyboardType="number-pad"
            autoComplete="birthdate-year"
            onSubmitEditing={submit}
          />
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.m },
  small: { flex: 1 },
  large: { flex: 1.5 },
});

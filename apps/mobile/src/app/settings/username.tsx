import { space } from '@vyra/design-system';
import { USERNAME_CHANGE_DAYS, normalizeUsername, usernameProblem } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { useMe } from '@/features/profile/profile-api';
import { useDebounced, useSetUsername, useUsernameCheck } from '@/features/search/search-api';
import { errorMessage } from '@/lib/api';

/** Choose or change the username people use to find and share your profile. */
export default function UsernameScreen() {
  const router = useRouter();
  const me = useMe().data;
  const current = me?.profile?.username ?? null;
  const lockedUntil = me?.profile?.usernameChangeableAt ?? null;
  const [text, setText] = useState(current ?? '');
  const save = useSetUsername();

  const name = normalizeUsername(text);
  const settled = useDebounced(name, 350);
  const problem = name.length > 0 ? usernameProblem(name) : null;
  const check = useUsernameCheck(problem === null && settled === name ? name : '');
  const unchanged = name === current;
  const checking = problem === null && name.length > 0 && (settled !== name || check.isFetching);
  const available = problem === null && !checking && check.data?.available === true;

  let error: string | undefined;
  let hint: string | undefined =
    `Letters, numbers, dots and underscores. ${USERNAME_CHANGE_DAYS} days between changes.`;
  if (name.length > 0 && problem) error = problem;
  else if (!checking && check.data && !check.data.available && !unchanged)
    error = check.data.reason ?? 'That name isn’t available';
  else if (checking) hint = 'Checking…';
  else if (available && !unchanged) hint = 'Available';

  const locked = lockedUntil !== null;
  return (
    <FormScreen
      eyebrow="Profile"
      title="Username"
      intro="People can find you by this name and share your profile with a QR code. It’s lower-case and shows as @name."
      footer={
        <Button
          label="Save username"
          loading={save.isPending}
          disabled={locked || unchanged || !available}
          onPress={() => save.mutate(name, { onSuccess: () => router.back() })}
        />
      }
    >
      <View style={styles.stack}>
        <TextField
          label="Username"
          prefix="@"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={38}
          editable={!locked}
          error={error}
          hint={hint}
        />
        {locked ? (
          <Text variant="caption" tone="textSecondary">
            You can change your username again on {new Date(lockedUntil).toLocaleDateString()}.
          </Text>
        ) : null}
        {save.isError ? <ErrorNotice message={errorMessage(save.error)} /> : null}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({ stack: { gap: space.m } });

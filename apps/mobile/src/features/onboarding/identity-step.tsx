import { PROFILE_LIMITS, profileUpdateSchema } from '@vyra/validation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { useMe, useUpdateProfile } from '@/features/profile/profile-api';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { type StepMode, useStepChrome } from './step-chrome';

export function IdentityStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 0);
  const profile = useMe().data?.profile;
  const save = useUpdateProfile();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? '');
  const [gender, setGender] = useState(profile?.gender ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [occupation, setOccupation] = useState(profile?.occupation ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const parsed = profileUpdateSchema.safeParse({
      displayName,
      pronouns,
      gender,
      city,
      occupation,
      bio,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.path[0] === 'displayName' ? 'Tell us what to call you' : 'That’s too long',
          ]),
        ),
      );
      return;
    }
    setErrors({});
    save.mutate(
      { displayName, pronouns, gender, city, occupation, bio },
      { onSuccess: chrome.advance },
    );
  }

  const serverField = (name: string) =>
    save.error instanceof ApiRequestError ? save.error.fieldError(name) : undefined;

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      title={mode === 'edit' ? 'About you.' : 'Let’s start with you.'}
      intro="Only your name is needed. The rest helps people read you properly."
      footer={<Button label={chrome.submitLabel} loading={save.isPending} onPress={submit} />}
    >
      <ErrorNotice
        message={
          save.isError && !(save.error instanceof ApiRequestError && save.error.details.length > 0)
            ? errorMessage(save.error)
            : undefined
        }
      />
      <TextField
        label="Name"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName ?? serverField('displayName')}
        maxLength={PROFILE_LIMITS.displayName}
        autoComplete="given-name"
        textContentType="givenName"
        autoCapitalize="words"
      />
      <TextField
        label="Pronouns (optional)"
        value={pronouns}
        onChangeText={setPronouns}
        error={errors.pronouns}
        maxLength={PROFILE_LIMITS.short}
        autoCapitalize="none"
      />
      <TextField
        label="Gender (optional)"
        value={gender}
        onChangeText={setGender}
        error={errors.gender}
        hint="In your own words."
        maxLength={PROFILE_LIMITS.short}
      />
      <TextField
        label="City (optional)"
        value={city}
        onChangeText={setCity}
        error={errors.city}
        maxLength={PROFILE_LIMITS.city}
        autoCapitalize="words"
      />
      <TextField
        label="What you do (optional)"
        value={occupation}
        onChangeText={setOccupation}
        error={errors.occupation}
        maxLength={PROFILE_LIMITS.occupation}
      />
      <TextField
        label="A few lines about you (optional)"
        value={bio}
        onChangeText={setBio}
        error={errors.bio}
        hint={`${bio.length} / ${PROFILE_LIMITS.bio}`}
        maxLength={PROFILE_LIMITS.bio}
        multiline
      />
    </FormScreen>
  );
}

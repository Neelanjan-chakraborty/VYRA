import { space } from '@vyra/design-system';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { Stepper } from '@/components/ui/stepper';
import { Tag } from '@/components/ui/tag';
import { useCompleteOnboarding, useMe, useSetPreferences } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';
import { type StepMode, useStepChrome } from './step-chrome';

const GENDERS = ['Women', 'Men', 'Non-binary people'] as const;
const DISTANCES: readonly { label: string; km: number | null }[] = [
  { label: 'Within 10 km', km: 10 },
  { label: 'Within 25 km', km: 25 },
  { label: 'Within 50 km', km: 50 },
  { label: 'Within 100 km', km: 100 },
  { label: 'Anywhere', km: null },
];

export function PreferencesStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 5);
  const me = useMe().data;
  const current = me?.discoveryPreferences;
  const save = useSetPreferences();
  const complete = useCompleteOnboarding();
  const ownAge = me?.age ?? 25;
  const [minAge, setMinAge] = useState(current?.minAge ?? Math.max(18, ownAge - 4));
  const [maxAge, setMaxAge] = useState(current?.maxAge ?? ownAge + 6);
  const [distance, setDistance] = useState<number | null>(current ? current.maxDistanceKm : 50);
  const [interestedIn, setInterestedIn] = useState<readonly string[]>(current?.interestedIn ?? []);

  function toggleGender(gender: string) {
    setInterestedIn((list) =>
      list.includes(gender) ? list.filter((g) => g !== gender) : [...list, gender],
    );
  }

  function submit() {
    save.mutate(
      {
        minAge,
        maxAge,
        maxDistanceKm: distance,
        interestedIn: [...interestedIn],
        showAstrology: current?.showAstrology ?? false,
        dealBreakers: current?.dealBreakers ?? [],
      },
      {
        onSuccess: () => {
          // Finishing onboarding flips the account to active; the root guard then shows the app.
          if (mode === 'onboarding') complete.mutate();
          else chrome.advance();
        },
      },
    );
  }

  const failure = save.error ?? complete.error;

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      title="Who should we look for?"
      intro="These are limits, not rankings. You can change them whenever you like."
      footer={
        <Button
          label={mode === 'onboarding' ? 'Finish' : chrome.submitLabel}
          loading={save.isPending || complete.isPending}
          onPress={submit}
        />
      }
    >
      <ErrorNotice message={failure ? errorMessage(failure) : undefined} />

      <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
        Age
      </Text>
      <View style={styles.ages}>
        <Stepper label="Youngest" value={minAge} min={18} max={maxAge} onChange={setMinAge} />
        <Stepper label="Oldest" value={maxAge} min={minAge} max={99} onChange={setMaxAge} />
      </View>

      <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
        Show me
      </Text>
      <View style={styles.tags}>
        {GENDERS.map((gender) => (
          <Tag
            key={gender}
            label={gender}
            selected={interestedIn.includes(gender)}
            onPress={() => toggleGender(gender)}
          />
        ))}
      </View>
      <Text variant="caption" tone="textSecondary" style={styles.note}>
        Leave all unselected to see everyone.
      </Text>

      <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
        Distance
      </Text>
      <View role="radiogroup" aria-label="Distance">
        {DISTANCES.map((option) => (
          <SelectRow
            key={option.label}
            kind="radio"
            label={option.label}
            selected={distance === option.km}
            onPress={() => setDistance(option.km)}
          />
        ))}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: space.l, marginBottom: space.m },
  ages: { flexDirection: 'row', gap: space.xl },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  note: { marginTop: space.s },
});

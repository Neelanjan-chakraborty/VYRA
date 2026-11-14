import { space } from '@vyra/design-system';
import {
  DISTANCE_OPTIONS_KM,
  GENDER_CATEGORIES,
  SHOW_GENDER_LABELS,
  type GenderCategory,
} from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { Stepper } from '@/components/ui/stepper';
import { Tag } from '@/components/ui/tag';
import { Toggle } from '@/components/ui/toggle';
import { useMe, useSetPreferences } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';
import { type StepMode, useStepChrome } from './step-chrome';

const DISTANCES: readonly { label: string; km: number | null }[] = [
  ...DISTANCE_OPTIONS_KM.map((km) => ({ label: `Within ${km} km`, km })),
  { label: 'Anywhere', km: null },
];

export function PreferencesStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 6);
  const me = useMe().data;
  const router = useRouter();
  const distanceAvailable = me?.location?.distanceAvailable ?? false;
  const current = me?.discoveryPreferences;
  const save = useSetPreferences();
  const ownAge = me?.age ?? 25;
  const [minAge, setMinAge] = useState(current?.minAge ?? Math.max(18, ownAge - 4));
  const [maxAge, setMaxAge] = useState(current?.maxAge ?? ownAge + 6);
  const [distance, setDistance] = useState<number | null>(current ? current.maxDistanceKm : 50);
  const [showGenders, setShowGenders] = useState<readonly GenderCategory[]>(
    current?.showGenders ?? [],
  );
  const [includeUnlisted, setIncludeUnlisted] = useState(current?.includeUnlistedGenders ?? true);

  function toggleGender(category: GenderCategory) {
    setShowGenders((list) =>
      list.includes(category) ? list.filter((g) => g !== category) : [...list, category],
    );
  }

  function submit() {
    save.mutate(
      {
        minAge,
        maxAge,
        maxDistanceKm: distance,
        showGenders: [...showGenders],
        includeUnlistedGenders: includeUnlisted,
        showAstrology: current?.showAstrology ?? false,
        criteria: current?.criteria ?? [],
      },
      {
        onSuccess: chrome.advance,
      },
    );
  }

  const failure = save.error;

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      title="Who should we look for?"
      intro="These are limits, not rankings. You can change them whenever you like."
      footer={<Button label={chrome.submitLabel} loading={save.isPending} onPress={submit} />}
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
        <Tag
          label="Everyone"
          selected={showGenders.length === 0}
          onPress={() => setShowGenders([])}
        />
        {GENDER_CATEGORIES.map((category) => (
          <Tag
            key={category}
            label={SHOW_GENDER_LABELS[category]}
            selected={showGenders.includes(category)}
            onPress={() => toggleGender(category)}
          />
        ))}
      </View>
      {showGenders.length > 0 ? (
        <View style={styles.unlisted}>
          <View style={styles.unlistedCopy}>
            <Text variant="bodyStrong">Also show people who describe their gender differently</Text>
            <Text variant="caption" tone="textSecondary">
              Includes people who self-describe, prefer not to say, or haven’t answered.
            </Text>
          </View>
          <Toggle
            label="Also show people who describe their gender differently"
            value={includeUnlisted}
            onChange={setIncludeUnlisted}
          />
        </View>
      ) : null}

      <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
        Distance
      </Text>
      {distanceAvailable ? null : (
        <View style={styles.distanceNotice} role="note">
          <Text variant="caption" tone="textSecondary">
            {me?.location
              ? 'Your location is a place we can’t measure from, so a distance limit won’t be applied.'
              : 'Distance isn’t used until you set a location. Your choice is saved and starts working when you do.'}
          </Text>
          <Button
            label="Set my location"
            variant="quiet"
            onPress={() => router.push(mode === 'edit' ? '/settings/location' : '/location')}
          />
        </View>
      )}
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
  distanceNotice: { marginBottom: space.s, gap: space.xs },
  unlisted: { flexDirection: 'row', alignItems: 'center', gap: space.l, marginTop: space.l },
  unlistedCopy: { flex: 1, gap: space.xxs },
});

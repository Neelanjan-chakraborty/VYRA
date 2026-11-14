import { color, space } from '@vyra/design-system';
import {
  CRITERIA,
  CRITERION_OPTIONS,
  type Criterion,
  type CriterionKey,
  type CriterionMode,
} from '@vyra/validation';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ModeSwitch } from '@/components/ui/mode-switch';
import { ErrorNotice } from '@/components/ui/notice';
import { Tag } from '@/components/ui/tag';
import { useCriteriaImpact } from '@/features/discovery/discovery-api';
import { useCompleteOnboarding, useMe, useSetPreferences } from '@/features/profile/profile-api';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { type StepMode, useStepChrome } from './step-chrome';

const MODES: readonly { value: CriterionMode; label: string }[] = [
  { value: 'must', label: 'Must-have' },
  { value: 'prefer', label: 'Preference' },
  { value: 'open', label: 'Open' },
];

const MODE_HINT: Record<CriterionMode, string> = {
  must: 'Strict: people known not to match are never shown. If we don’t know, they still are.',
  prefer: 'People who match rank higher. Nobody is hidden.',
  open: 'Doesn’t affect who you see.',
};

type Draft = Record<CriterionKey, { mode: CriterionMode; accepted: string[] }>;

function toDraft(criteria: readonly Criterion[]): Draft {
  const draft = Object.fromEntries(
    CRITERIA.map((key) => [key, { mode: 'open' as CriterionMode, accepted: [] as string[] }]),
  ) as Draft;
  for (const c of criteria) draft[c.criterion] = { mode: c.mode, accepted: [...c.accepted] };
  return draft;
}

/** Must-haves (strict filters), preferences (ranking) and open — kept private. */
export function MattersStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 7);
  const me = useMe().data;
  const prefs = me?.discoveryPreferences;
  const save = useSetPreferences();
  const complete = useCompleteOnboarding();
  const impact = useCriteriaImpact();
  const [draft, setDraft] = useState<Draft>(() => toDraft(prefs?.criteria ?? []));

  const update = (key: CriterionKey, patch: Partial<Draft[CriterionKey]>) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  const toggle = (key: CriterionKey, value: string) =>
    update(key, {
      accepted: draft[key].accepted.includes(value)
        ? draft[key].accepted.filter((v) => v !== value)
        : [...draft[key].accepted, value],
    });

  const finish = () => {
    if (mode === 'onboarding') complete.mutate();
    else chrome.advance();
  };

  function submit() {
    if (!prefs) return finish();
    const criteria = CRITERIA.filter((key) => draft[key].mode !== 'open').map((key) => ({
      criterion: key,
      mode: draft[key].mode,
      accepted: draft[key].accepted,
    }));
    save.mutate(
      { ...prefs, criteria },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['criteria-impact'] });
          void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
          finish();
        },
      },
    );
  }

  const strict = prefs
    ? [
        `Ages ${prefs.minAge}–${prefs.maxAge}`,
        prefs.showGenders.length > 0 ? 'Your “show me” choice' : null,
        prefs.maxDistanceKm !== null
          ? me?.location?.distanceAvailable
            ? `Within ${prefs.maxDistanceKm} km`
            : `Within ${prefs.maxDistanceKm} km (inactive until you set a location)`
          : null,
      ].filter(Boolean)
    : [];

  const fieldError =
    save.error instanceof ApiRequestError && save.error.details.length > 0
      ? 'Choose at least one option for each must-have or preference, and don’t make a must-have out of every option.'
      : undefined;
  const failure =
    fieldError ??
    (save.error
      ? errorMessage(save.error)
      : complete.error
        ? errorMessage(complete.error)
        : undefined);
  const hasAnyChoice = CRITERIA.some((key) => draft[key].mode !== 'open');

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      headerAction={
        mode === 'onboarding' ? (
          <Pressable role="button" aria-label="Skip this step" onPress={finish} hitSlop={12}>
            <Text variant="bodyStrong" tone="textSecondary">
              Skip
            </Text>
          </Pressable>
        ) : null
      }
      title="What matters to you?"
      intro="Optional, and private — nobody else sees these. Everything starts as open."
      footer={
        <Button
          label={mode === 'onboarding' ? 'Finish' : 'Save'}
          loading={save.isPending || complete.isPending}
          onPress={submit}
        />
      }
    >
      <ErrorNotice message={failure} />

      {impact.data?.significant ? (
        <View style={styles.impact} role="alert">
          <Text variant="bodyStrong" tone="chemistryText">
            Your must-haves are narrowing things a lot
          </Text>
          <Text variant="caption" tone="textSecondary">
            Of the people who otherwise fit, about {impact.data.withMustHaves} remain (from{' '}
            {impact.data.withoutMustHaves}). Turning a must-have into a preference keeps people
            visible while still ranking your choices first.
          </Text>
        </View>
      ) : null}

      {strict.length > 0 ? (
        <View style={styles.strict}>
          <Text variant="eyebrow" tone="textSecondary">
            Always strict
          </Text>
          <Text variant="caption" tone="textSecondary" style={styles.strictList}>
            {strict.join(' · ')}
          </Text>
        </View>
      ) : null}

      {CRITERIA.map((key) => {
        const entry = draft[key];
        const definition = CRITERION_OPTIONS[key];
        return (
          <View key={key} style={styles.criterion} role="group" aria-label={definition.label}>
            <Text variant="title">{definition.label}</Text>
            <ModeSwitch
              label={definition.label}
              value={entry.mode}
              options={MODES}
              onChange={(m) => update(key, { mode: m })}
            />
            <Text variant="caption" tone="textSecondary">
              {MODE_HINT[entry.mode]}
            </Text>
            {entry.mode !== 'open' ? (
              <View style={styles.tags}>
                {definition.options.map((o) => (
                  <Tag
                    key={o.value}
                    label={o.label}
                    selected={entry.accepted.includes(o.value)}
                    onPress={() => toggle(key, o.value)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {hasAnyChoice ? (
        <Button label="Clear all" variant="quiet" onPress={() => setDraft(toDraft([]))} />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  impact: {
    borderLeftWidth: 2,
    borderLeftColor: color.chemistry,
    paddingLeft: space.m,
    marginBottom: space.xl,
    gap: space.xs,
  },
  strict: { marginBottom: space.xl, gap: space.xs },
  strictList: { marginTop: space.xxs },
  criterion: {
    paddingVertical: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    gap: space.s,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.xs },
});

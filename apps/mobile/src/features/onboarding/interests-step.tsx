import { space } from '@vyra/design-system';
import { MAX_INTERESTS, type Interest } from '@vyra/validation';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { Tag } from '@/components/ui/tag';
import { useInterestCatalogue, useMe, useSetInterests } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';
import { type StepMode, useStepChrome } from './step-chrome';

const CATEGORY_TITLES: Record<string, string> = {
  music: 'Music',
  screen: 'Screen',
  ideas: 'Ideas',
  food: 'Food',
  outdoors: 'Outdoors',
  movement: 'Movement',
  making: 'Making',
  play: 'Play',
};

export function InterestsStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 2, { optional: true });
  const catalogue = useInterestCatalogue();
  const current = useMe().data?.interests ?? [];
  const save = useSetInterests();
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(current.map((i) => i.id)),
  );

  function toggle(id: string) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_INTERESTS) next.add(id);
      return next;
    });
  }

  const groups = new Map<string, Interest[]>();
  for (const interest of catalogue.data?.interests ?? []) {
    groups.set(interest.category, [...(groups.get(interest.category) ?? []), interest]);
  }

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      headerAction={chrome.skipAction}
      title="What pulls you in?"
      intro="Optional. Pick what’s true, not what sounds good — shared interests are shown to people you match with."
      footer={
        <Button
          label={picked.size > 0 ? `${chrome.submitLabel} with ${picked.size}` : chrome.submitLabel}
          loading={save.isPending}
          onPress={() => save.mutate([...picked], { onSuccess: chrome.advance })}
        />
      }
    >
      <ErrorNotice
        message={
          save.isError
            ? errorMessage(save.error)
            : catalogue.isError
              ? errorMessage(catalogue.error)
              : undefined
        }
      />
      {catalogue.isPending ? <ActivityIndicator /> : null}
      {catalogue.isError ? (
        <Button label="Try again" variant="secondary" onPress={() => void catalogue.refetch()} />
      ) : null}
      {[...groups].map(([category, interests]) => (
        <View
          key={category}
          style={styles.group}
          role="group"
          aria-label={CATEGORY_TITLES[category] ?? category}
        >
          <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
            {CATEGORY_TITLES[category] ?? category}
          </Text>
          <View style={styles.tags}>
            {interests.map((interest) => (
              <Tag
                key={interest.id}
                label={interest.label}
                selected={picked.has(interest.id)}
                onPress={() => toggle(interest.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: space.xl },
  heading: { marginBottom: space.m },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
});

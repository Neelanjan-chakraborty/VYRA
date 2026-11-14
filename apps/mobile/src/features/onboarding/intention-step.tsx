import { space } from '@vyra/design-system';
import type { RelationshipIntent } from '@vyra/validation';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { TextField } from '@/components/ui/text-field';
import { useMe, useSetIntents } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';
import { type StepMode, useStepChrome } from './step-chrome';

const OPTIONS: readonly { kind: RelationshipIntent; label: string; description: string }[] = [
  { kind: 'serious', label: 'Something serious', description: 'A relationship with a future.' },
  { kind: 'casual', label: 'Something casual', description: 'Dating without a destination.' },
  { kind: 'exploring', label: 'Still working it out', description: 'Open to seeing what fits.' },
  {
    kind: 'companionship',
    label: 'Companionship',
    description: 'Someone to do life’s small things with.',
  },
  { kind: 'other', label: 'Something else', description: 'Say it your way.' },
];

export function IntentionStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 3);
  const current = useMe().data?.relationshipIntents ?? [];
  const save = useSetIntents();
  const [picked, setPicked] = useState<ReadonlySet<RelationshipIntent>>(
    () => new Set(current.map((i) => i.kind)),
  );
  const [custom, setCustom] = useState(current.find((i) => i.kind === 'other')?.customLabel ?? '');
  const [customError, setCustomError] = useState<string>();

  function toggle(kind: RelationshipIntent) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function submit() {
    if (picked.has('other') && custom.trim() === '') {
      setCustomError('Tell us what you’re looking for');
      return;
    }
    setCustomError(undefined);
    save.mutate(
      {
        intents: OPTIONS.filter((option) => picked.has(option.kind)).map((option) =>
          option.kind === 'other'
            ? { kind: option.kind, customLabel: custom.trim() }
            : { kind: option.kind },
        ),
      },
      { onSuccess: chrome.advance },
    );
  }

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      title="What are you here for?"
      intro="Choose as many as are true. You’re only shown people whose intentions overlap with yours."
      footer={
        <Button
          label={chrome.submitLabel}
          loading={save.isPending}
          disabled={picked.size === 0}
          onPress={submit}
        />
      }
    >
      <ErrorNotice message={save.isError ? errorMessage(save.error) : undefined} />
      {OPTIONS.map((option) => (
        <SelectRow
          key={option.kind}
          label={option.label}
          description={option.description}
          selected={picked.has(option.kind)}
          onPress={() => toggle(option.kind)}
        />
      ))}
      {picked.has('other') ? (
        <View style={{ marginTop: space.l }}>
          <TextField
            label="In your words"
            value={custom}
            onChangeText={setCustom}
            error={customError}
            maxLength={60}
            autoFocus
          />
        </View>
      ) : null}
    </FormScreen>
  );
}

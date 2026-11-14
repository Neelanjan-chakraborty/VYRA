import { color, space } from '@vyra/design-system';
import type { PersonaAttributeKey, PersonaAttributeValue } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { Toggle } from '@/components/ui/toggle';
import { errorMessage } from '@/lib/api';
import { AttributeEditor } from './attribute-editor';
import { FAILURE_MESSAGES } from './format';
import {
  hasConsent,
  useApprovePersona,
  useClearPersona,
  useConsents,
  useDiscardDraft,
  useEditPersona,
  useGeneratePersona,
  usePersona,
  useSetConsent,
} from './persona-api';
import { PersonaReview } from './persona-review';

export type PersonaScreenMode = 'onboarding' | 'settings';

/** Review and edit the persona. In onboarding it ends by moving on to preferences. */
export function PersonaScreen({ mode }: { readonly mode: PersonaScreenMode }) {
  const router = useRouter();
  const persona = usePersona();
  const consents = useConsents();
  const setConsent = useSetConsent();
  const generate = useGeneratePersona();
  const edit = useEditPersona();
  const approve = useApprovePersona();
  const discard = useDiscardDraft();
  const clear = useClearPersona();
  const [editing, setEditing] = useState<PersonaAttributeKey | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const view = persona.data;
  const version = view?.draft ?? view?.current ?? null;
  const isDraft = view?.draft !== null && view?.draft !== undefined;
  const profileConsent = hasConsent(consents.data, 'AI_PERSONA_PROCESSING');
  const working = view?.generation.status === 'queued' || view?.generation.status === 'generating';
  const failure = view?.generation.status === 'failed' ? view.generation.failureCode : null;
  const mutationError =
    edit.error ??
    approve.error ??
    discard.error ??
    generate.error ??
    setConsent.error ??
    clear.error;

  const finishOnboarding = () => router.push('/location');

  async function approveDraft() {
    await approve.mutateAsync();
    // With consent, refresh from the profile too: the result arrives as a new draft to review later.
    if (mode === 'onboarding') {
      if (profileConsent) generate.mutate();
      finishOnboarding();
    }
  }

  function save(key: PersonaAttributeKey, value: PersonaAttributeValue) {
    edit.mutate({ set: { [key]: value } }, { onSuccess: () => setEditing(null) });
  }

  const footer = isDraft ? (
    <>
      <Button
        label={mode === 'onboarding' ? 'Approve and continue' : 'Approve'}
        loading={approve.isPending}
        onPress={() => void approveDraft()}
      />
      <Button
        label={mode === 'onboarding' ? 'Skip for now' : 'Discard draft'}
        variant="quiet"
        onPress={() => (mode === 'onboarding' ? finishOnboarding() : discard.mutate())}
      />
    </>
  ) : mode === 'onboarding' ? (
    <Button label="Continue" onPress={finishOnboarding} />
  ) : null;

  return (
    <FormScreen
      eyebrow={mode === 'onboarding' ? 'Your persona' : 'Settings'}
      title={isDraft ? 'Is this you?' : 'Your persona.'}
      intro="A working description VYRA uses to suggest people. It is not a personality test. Nothing here is shown to anyone until you approve it, and you can change any of it."
      footer={footer}
    >
      <ErrorNotice message={mutationError ? errorMessage(mutationError) : undefined} />
      {persona.isPending ? <ActivityIndicator color={color.textSecondary} /> : null}
      {persona.isError ? (
        <>
          <ErrorNotice message={errorMessage(persona.error)} />
          <Button label="Try again" variant="secondary" onPress={() => void persona.refetch()} />
        </>
      ) : null}

      {working ? (
        <View style={styles.status} role="status">
          <ActivityIndicator color={color.textSecondary} />
          <Text tone="textSecondary">Reading your profile…</Text>
        </View>
      ) : null}
      {failure ? (
        <ErrorNotice message={FAILURE_MESSAGES[failure] ?? FAILURE_MESSAGES.provider_error} />
      ) : null}

      {isDraft && view?.current ? (
        <Text variant="caption" tone="chemistryText" style={styles.banner}>
          These are new suggestions. Your approved persona stays in use until you approve this.
        </Text>
      ) : null}

      {version ? (
        <PersonaReview
          version={version}
          onEdit={setEditing}
          onConfirm={(key) => edit.mutate({ confirm: [key] })}
          onRemove={(key) => edit.mutate({ clear: [key] })}
        />
      ) : view && !working ? (
        <Text tone="textSecondary" style={styles.empty}>
          Nothing here yet. Let VYRA read your profile, or ask the AI you already use.
        </Text>
      ) : null}

      {view && mode === 'settings' ? (
        <View style={styles.sources}>
          <Text variant="eyebrow" tone="textSecondary">
            Sources
          </Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text variant="bodyStrong">Suggestions from my profile</Text>
              <Text variant="caption" tone="textSecondary">
                VYRA reads your bio, interests and intentions. Not your photos, name or location.
              </Text>
            </View>
            <Toggle
              label="Suggestions from my profile"
              value={profileConsent}
              disabled={setConsent.isPending || consents.isPending}
              onChange={(granted) => setConsent.mutate({ type: 'AI_PERSONA_PROCESSING', granted })}
            />
          </View>
          {profileConsent ? (
            <Button
              label="Suggest from my profile now"
              variant="secondary"
              loading={generate.isPending}
              disabled={working}
              onPress={() => generate.mutate()}
            />
          ) : null}
          <Button
            label="Ask the AI you use"
            variant="secondary"
            onPress={() => router.push('/settings/ask-ai')}
          />
          {view.current ? (
            <Button
              label="Delete my persona"
              variant="quiet"
              onPress={() => setConfirmingClear(true)}
            />
          ) : null}
        </View>
      ) : null}

      <AttributeEditor
        attribute={editing}
        initial={editing ? version?.attributes[editing]?.value : undefined}
        saving={edit.isPending}
        onSave={save}
        onClose={() => setEditing(null)}
      />
      <BottomSheet
        visible={confirmingClear}
        title="Delete your persona?"
        onClose={() => setConfirmingClear(false)}
      >
        <Text tone="textSecondary" style={styles.sheetBody}>
          Every version and everything it was based on is removed. You can build a new one any time.
        </Text>
        <View style={styles.sheetActions}>
          <Button
            label="Delete persona"
            variant="danger"
            loading={clear.isPending}
            onPress={() => clear.mutate(undefined, { onSuccess: () => setConfirmingClear(false) })}
          />
          <Button label="Keep it" variant="quiet" onPress={() => setConfirmingClear(false)} />
        </View>
      </BottomSheet>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginBottom: space.xl },
  banner: { marginBottom: space.xl },
  empty: { marginBottom: space.xl },
  sources: { gap: space.m, marginTop: space.l },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.l, paddingVertical: space.s },
  toggleCopy: { flex: 1, gap: space.xxs },
  sheetBody: { marginBottom: space.l },
  sheetActions: { gap: space.m },
});

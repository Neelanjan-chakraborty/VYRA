import { space } from '@vyra/design-system';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import {
  hasConsent,
  useConsents,
  useGeneratePersona,
  useSetConsent,
} from '@/features/persona/persona-api';
import { errorMessage } from '@/lib/api';
import { useStepChrome } from './step-chrome';

/** Optional: let VYRA draft a persona from the profile, and/or bring in what an assistant knows. */
export function UnderstandStep() {
  const router = useRouter();
  const chrome = useStepChrome('onboarding', 4, { optional: true });
  const consents = useConsents();
  const setConsent = useSetConsent();
  const generate = useGeneratePersona();
  const allowed = hasConsent(consents.data, 'AI_PERSONA_PROCESSING');

  function next() {
    // The draft is prepared in the background and offered for review under You.
    if (allowed) generate.mutate(undefined, { onSettled: chrome.advance });
    else chrome.advance();
  }

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      headerAction={chrome.skipAction}
      title="Help VYRA understand you."
      intro="Both are optional, and nothing is used until you’ve reviewed and approved it."
      footer={<Button label={chrome.submitLabel} loading={generate.isPending} onPress={next} />}
    >
      <ErrorNotice message={setConsent.error ? errorMessage(setConsent.error) : undefined} />
      <SelectRow
        label="Draft a persona from my profile"
        description="VYRA reads your bio, interests and intentions — not your photos, name or location — and suggests how you tend to communicate and live."
        selected={allowed}
        onPress={() => setConsent.mutate({ type: 'AI_PERSONA_PROCESSING', granted: !allowed })}
      />
      <View style={styles.ask}>
        <Text variant="bodyStrong">Use an AI that already knows you</Text>
        <Text variant="caption" tone="textSecondary" style={styles.caption}>
          Ask ChatGPT, Gemini, Claude or another assistant to describe you, then paste its answer
          here.
        </Text>
        <Button
          label="Ask the AI you use"
          variant="secondary"
          onPress={() => router.push('/ask-ai')}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  ask: { marginTop: space.xxl, gap: space.s },
  caption: { marginBottom: space.s },
});

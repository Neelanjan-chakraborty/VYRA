import { color, radius, space, typography } from '@vyra/design-system';
import {
  ASSISTANTS,
  assistantInfo,
  assistantPromptUrl,
  buildQuestionnairePrompt,
  QUESTIONNAIRE_ATTRIBUTES,
  QUESTIONNAIRE_REPLY_MAX_CHARS,
  type AssistantId,
} from '@vyra/validation';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { TextField } from '@/components/ui/text-field';
import { errorMessage } from '@/lib/api';
import { hasConsent, useAssistantReflection, useConsents, useSetConsent } from './persona-api';

const CODE_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

type Stage = 'pick' | 'copy' | 'paste';

/**
 * Lets someone borrow what their own AI assistant already knows about them:
 * VYRA gives them a questionnaire to paste into it, and reads back the answer
 * they choose to paste here. VYRA never connects to the assistant itself.
 */
export function AskAiScreen({ mode }: { readonly mode: 'onboarding' | 'settings' }) {
  const router = useRouter();
  const consents = useConsents();
  const setConsent = useSetConsent();
  const reflection = useAssistantReflection();
  const [stage, setStage] = useState<Stage>('pick');
  const [assistant, setAssistant] = useState<AssistantId | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [reply, setReply] = useState('');
  const [agree, setAgree] = useState(false);
  const info = assistant ? assistantInfo(assistant) : null;
  const prompt = assistant ? buildQuestionnairePrompt(assistant) : '';
  const alreadyAgreed = hasConsent(consents.data, 'AI_IMPORT_PROCESSING');

  async function copyPrompt() {
    await Clipboard.setStringAsync(prompt);
    setCopied(true);
  }

  /** Copies the questions, then opens the assistant with them pre-filled where it can. */
  async function openWithQuestions() {
    if (!assistant) return;
    await copyPrompt();
    const url = assistantPromptUrl(assistant, prompt);
    if (url) await Linking.openURL(url);
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync();
    if (text) setReply(text.slice(0, QUESTIONNAIRE_REPLY_MAX_CHARS));
  }

  async function submit() {
    if (!assistant) return;
    if (!alreadyAgreed)
      await setConsent.mutateAsync({ type: 'AI_IMPORT_PROCESSING', granted: true });
    await reflection.mutateAsync({ assistant, reply });
    router.replace(mode === 'onboarding' ? '/persona' : '/settings/persona');
  }

  const back = () =>
    stage === 'paste' ? setStage('copy') : stage === 'copy' ? setStage('pick') : router.back();
  const failure = reflection.error ?? setConsent.error;

  if (stage === 'pick') {
    return (
      <FormScreen
        eyebrow="Ask your AI"
        title="Which assistant knows you best?"
        intro="If you talk to an AI assistant often, it may already know how you think and communicate. You can ask it to describe you, read the answer, and bring it here. VYRA never connects to your assistant."
        footer={<Button label="Continue" disabled={!assistant} onPress={() => setStage('copy')} />}
      >
        <View role="radiogroup" aria-label="Assistant">
          {ASSISTANTS.map((a) => (
            <SelectRow
              key={a.id}
              kind="radio"
              label={a.name}
              description={
                a.remembers
                  ? undefined
                  : 'Usually doesn’t remember past chats, so answers may be thin.'
              }
              selected={assistant === a.id}
              onPress={() => setAssistant(a.id)}
            />
          ))}
        </View>
      </FormScreen>
    );
  }

  if (stage === 'copy' && info) {
    return (
      <FormScreen
        eyebrow={`Ask ${info.name}`}
        title="Copy the questions."
        intro={`Paste them into ${info.name}. It answers ${QUESTIONNAIRE_ATTRIBUTES.length} questions about your tendencies — or says “unknown” — in a format VYRA can read. Read its answer before bringing it back.`}
        footer={
          <>
            <Button
              label={copied ? 'Copied' : 'Copy questions'}
              onPress={() => void copyPrompt()}
            />
            <Button
              label="I have the answer"
              variant="secondary"
              disabled={!copied}
              onPress={() => setStage('paste')}
            />
          </>
        }
      >
        <View aria-live="polite">
          {copied ? (
            <Text variant="caption" tone="success" style={styles.copied}>
              Copied. Now paste it into {info.name}.
            </Text>
          ) : null}
        </View>
        {assistant && assistantPromptUrl(assistant, prompt) ? (
          <>
            <Button
              label={`Open ${info.name} with the questions`}
              variant="secondary"
              onPress={() => void openWithQuestions()}
            />
            <Text variant="caption" tone="textSecondary">
              The questions are copied too. If they don’t appear in the message box, paste them.
            </Text>
          </>
        ) : info.url ? (
          <Button
            label={`Open ${info.name}`}
            variant="quiet"
            onPress={() => void Linking.openURL(info.url as string)}
          />
        ) : null}
        <Button
          label={showPrompt ? 'Hide the questions' : 'Read the questions first'}
          variant="quiet"
          onPress={() => setShowPrompt((s) => !s)}
        />
        {showPrompt ? (
          <View style={styles.prompt}>
            <Text selectable style={styles.code}>
              {prompt}
            </Text>
          </View>
        ) : null}
        <Button label="Choose a different assistant" variant="quiet" onPress={back} />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      eyebrow={`From ${info?.name ?? 'your assistant'}`}
      title="Paste the answer."
      intro="Paste the whole reply. Only the answers to the questions are read; the reply itself isn’t kept."
      footer={
        <Button
          label="Read the answers"
          loading={reflection.isPending || setConsent.isPending}
          disabled={reply.trim() === '' || !(alreadyAgreed || agree)}
          onPress={() => void submit().catch(() => undefined)}
        />
      }
    >
      <ErrorNotice message={failure ? errorMessage(failure) : undefined} />
      <TextField
        label="Assistant’s reply"
        value={reply}
        onChangeText={setReply}
        multiline
        lines={10}
        maxLength={QUESTIONNAIRE_REPLY_MAX_CHARS}
        hint={`${reply.length.toLocaleString()} of ${QUESTIONNAIRE_REPLY_MAX_CHARS.toLocaleString()} characters. Paste the assistant’s whole reply.`}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button
        label="Paste from clipboard"
        variant="secondary"
        onPress={() => void pasteFromClipboard()}
      />
      {alreadyAgreed ? null : (
        <View style={styles.consent}>
          <SelectRow
            label="Let VYRA read the answers I paste"
            description="Used only to suggest your persona, which you review before anything is saved. You can withdraw this in Settings."
            selected={agree}
            onPress={() => setAgree((a) => !a)}
          />
        </View>
      )}
      <Button label="Back to the questions" variant="quiet" onPress={back} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  copied: { marginBottom: space.m },
  prompt: {
    marginVertical: space.m,
    padding: space.l,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  code: { ...typography.caption, fontFamily: CODE_FONT, color: color.textSecondary },
  consent: { marginVertical: space.l },
});

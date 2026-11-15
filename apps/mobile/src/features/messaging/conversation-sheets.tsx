import { color, space } from '@vyra/design-system';
import {
  type ConversationSettings,
  DATE_PLAN_LIMITS,
  type MessageView,
  type WingmanPurpose,
} from '@vyra/validation';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { useConsents, useSetConsent } from '@/features/persona/persona-api';
import { errorMessage } from '@/lib/api';
import { useSendPlan, useWingman } from './messaging-api';

function SettingRow(props: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.setting}>
      <View style={styles.settingCopy}>
        <Text variant="bodyStrong">{props.label}</Text>
        <Text variant="caption" tone="textSecondary">
          {props.description}
        </Text>
      </View>
      <Toggle label={props.label} value={props.value} onChange={props.onChange} />
    </View>
  );
}

/** Photo, voice note, date idea or Wingman. */
export function AddSheet(props: {
  visible: boolean;
  onClose: () => void;
  onPhoto: () => void;
  onVoice: () => void;
  onPlan: () => void;
  onWingman: () => void;
}) {
  return (
    <BottomSheet visible={props.visible} title="Add to the conversation" onClose={props.onClose}>
      <View style={styles.stack}>
        <Button label="Photo" variant="secondary" onPress={props.onPhoto} />
        <Button label="Voice note" variant="secondary" onPress={props.onVoice} />
        <Button label="Date idea" variant="secondary" onPress={props.onPlan} />
        <Button label="Ask Wingman for ideas" variant="secondary" onPress={props.onWingman} />
      </View>
    </BottomSheet>
  );
}

export function PlanSheet(props: {
  conversationId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const send = useSendPlan(props.conversationId);
  const [idea, setIdea] = useState('');
  const [when, setWhen] = useState('');
  const [area, setArea] = useState('');
  const close = () => {
    setIdea('');
    setWhen('');
    setArea('');
    send.reset();
    props.onClose();
  };
  return (
    <BottomSheet visible={props.visible} title="Suggest a date" onClose={close}>
      <Text tone="textSecondary" style={styles.intro}>
        Something easy and public works best for a first meeting.
      </Text>
      <TextField
        label="The idea"
        value={idea}
        onChangeText={setIdea}
        maxLength={DATE_PLAN_LIMITS.idea}
        placeholder="Filter coffee and a walk"
      />
      <TextField
        label="When (optional)"
        value={when}
        onChangeText={setWhen}
        maxLength={DATE_PLAN_LIMITS.when}
        placeholder="Saturday morning"
      />
      <TextField
        label="Where, roughly (optional)"
        value={area}
        onChangeText={setArea}
        maxLength={DATE_PLAN_LIMITS.area}
        placeholder="A neighbourhood or a café"
      />
      {send.isError ? <ErrorNotice message={errorMessage(send.error)} /> : null}
      <Button
        label="Send idea"
        disabled={idea.trim().length === 0}
        loading={send.isPending}
        onPress={() =>
          send.mutate(
            {
              idea: idea.trim(),
              ...(when.trim() ? { when: when.trim() } : {}),
              ...(area.trim() ? { area: area.trim() } : {}),
            },
            { onSuccess: close },
          )
        }
      />
    </BottomSheet>
  );
}

const PURPOSES: readonly { value: WingmanPurpose; label: string }[] = [
  { value: 'opener', label: 'Start the conversation' },
  { value: 'reply', label: 'Help me reply' },
  { value: 'date_idea', label: 'Suggest a date' },
];

/**
 * Wingman suggests; the person chooses, edits and sends. It needs its own
 * consent, and reads recent messages only if allowed for this conversation.
 */
export function WingmanSheet(props: {
  conversationId: string;
  visible: boolean;
  onClose: () => void;
  onChoose: (text: string) => void;
}) {
  const consents = useConsents();
  const setConsent = useSetConsent();
  const wingman = useWingman(props.conversationId);
  const enabled = consents.data?.consents.find((c) => c.type === 'WINGMAN')?.granted ?? false;
  const close = () => {
    wingman.reset();
    props.onClose();
  };
  return (
    <BottomSheet visible={props.visible} title="Wingman" onClose={close}>
      {!enabled ? (
        <>
          <Text tone="textSecondary" style={styles.intro}>
            Wingman suggests messages you can edit before sending. It uses what you both show on
            your profiles and why you might connect. It never sends anything, and it reads your
            messages only if you allow that for this conversation.
          </Text>
          {setConsent.isError ? <ErrorNotice message={errorMessage(setConsent.error)} /> : null}
          <Button
            label="Turn on Wingman"
            loading={setConsent.isPending}
            onPress={() => setConsent.mutate({ type: 'WINGMAN', granted: true })}
          />
        </>
      ) : (
        <>
          <View style={styles.row}>
            {PURPOSES.map((p) => (
              <Button
                key={p.value}
                label={p.label}
                variant={wingman.variables === p.value ? 'primary' : 'secondary'}
                loading={wingman.isPending && wingman.variables === p.value}
                onPress={() => wingman.mutate(p.value)}
                style={styles.purpose}
              />
            ))}
          </View>
          {wingman.isError ? <ErrorNotice message={errorMessage(wingman.error)} /> : null}
          {wingman.data && wingman.data.suggestions.length === 0 ? (
            <Text tone="textSecondary">No ideas this time. Try another option.</Text>
          ) : null}
          {wingman.data?.suggestions.map((text) => (
            <SelectRow
              key={text}
              label={text}
              description="Use this, then edit it"
              selected={false}
              onPress={() => {
                props.onChoose(text);
                close();
              }}
            />
          ))}
          {wingman.data ? (
            <Text variant="caption" tone="textSecondary" style={styles.footnote}>
              {wingman.data.usedMessages
                ? 'Based on your profiles and recent messages.'
                : 'Based on your profiles only.'}
            </Text>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}

/** Per-conversation privacy: read receipts, typing, Wingman's access, mute. */
export function SettingsSheet(props: {
  visible: boolean;
  onClose: () => void;
  settings: ConversationSettings;
  onChange: (update: Partial<ConversationSettings>) => void;
  onProfile: () => void;
  onEnd: (() => void) | null;
  onBlock: () => void;
  name: string;
}) {
  const consents = useConsents();
  const setConsent = useSetConsent();
  const contextConsent =
    consents.data?.consents.find((c) => c.type === 'WINGMAN_MESSAGE_CONTEXT')?.granted ?? false;
  const { settings } = props;
  return (
    <BottomSheet visible={props.visible} title="Conversation settings" onClose={props.onClose}>
      <SettingRow
        label="Read receipts"
        description="Show when you’ve read their messages. Off means you won’t see theirs either."
        value={settings.sendsReadReceipts}
        onChange={(v) => props.onChange({ sendsReadReceipts: v })}
      />
      <SettingRow
        label="Show when I’m typing"
        description={`${props.name} sees “typing…” while you write.`}
        value={settings.sharesTyping}
        onChange={(v) => props.onChange({ sharesTyping: v })}
      />
      <SettingRow
        label="Let Wingman read recent messages"
        description="Only when you ask Wingman for help here. Never shared with anyone."
        value={settings.wingmanContextEnabled && contextConsent}
        onChange={(v) => {
          if (v && !contextConsent)
            setConsent.mutate({ type: 'WINGMAN_MESSAGE_CONTEXT', granted: true });
          props.onChange({ wingmanContextEnabled: v });
        }}
      />
      <SettingRow
        label="Mute notifications"
        description="No push notifications from this conversation."
        value={settings.muted}
        onChange={(v) => props.onChange({ muted: v })}
      />
      <View style={styles.stack}>
        <Button
          label={`View ${props.name}’s profile`}
          variant="secondary"
          onPress={props.onProfile}
        />
        {props.onEnd ? (
          <Button label="End connection" variant="secondary" onPress={props.onEnd} />
        ) : null}
        <Button label={`Block ${props.name}`} variant="danger" onPress={props.onBlock} />
      </View>
    </BottomSheet>
  );
}

const REPORT_REASONS = [
  { value: 'HARASSMENT', label: 'Harassment or hateful' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate' },
  { value: 'SPAM_OR_SCAM', label: 'Spam or scam' },
  { value: 'OTHER', label: 'Something else' },
] as const;

/** Remove your own message, or report theirs (which hides it from you). */
export function MessageActionsSheet(props: {
  message: MessageView | null;
  onClose: () => void;
  onRemove: (message: MessageView) => void;
  onReport: (message: MessageView, reason: (typeof REPORT_REASONS)[number]['value']) => void;
}) {
  const { message } = props;
  return (
    <BottomSheet
      visible={message !== null}
      title={message?.mine ? 'Your message' : 'Report this message?'}
      onClose={props.onClose}
    >
      {message?.mine ? (
        <>
          <Text tone="textSecondary" style={styles.intro}>
            Removing deletes it for both of you.
          </Text>
          <Button label="Remove message" variant="danger" onPress={() => props.onRemove(message)} />
        </>
      ) : message ? (
        <>
          <Text tone="textSecondary" style={styles.intro}>
            It will be hidden from you and sent to our team.
          </Text>
          {REPORT_REASONS.map((reason) => (
            <SelectRow
              key={reason.value}
              kind="radio"
              label={reason.label}
              selected={false}
              onPress={() => props.onReport(message, reason.value)}
            />
          ))}
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: space.l },
  stack: { gap: space.s, marginTop: space.l },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginBottom: space.m },
  purpose: { paddingHorizontal: space.m },
  footnote: { marginTop: space.m },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  settingCopy: { flex: 1, gap: space.xxs },
});

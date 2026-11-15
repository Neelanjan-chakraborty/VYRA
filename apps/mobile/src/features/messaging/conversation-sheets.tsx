import { chatThemes, color, MIN_TOUCH_TARGET, radius, space } from '@vyra/design-system';
import {
  CHAT_THEMES,
  type ConversationSettings,
  DATE_PLAN_LIMITS,
  DISAPPEAR_CHOICES,
  TIMER_CHOICES,
  MAX_FORWARD_TARGETS,
  type MessageView,
  type Reaction,
  REACTIONS,
  type WingmanPurpose,
} from '@vyra/validation';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { useConsents, useSetConsent } from '@/features/persona/persona-api';
import { errorMessage } from '@/lib/api';
import { ChatIcon, type ChatIconName } from './chat-icons';
import { timerLabel } from './media-views';
import {
  useCancelScheduled,
  useConversations,
  useForward,
  usePin,
  usePinned,
  useScheduled,
  useScheduleMessage,
  useSendPlan,
  type MediaProtection,
  NO_PROTECTION,
  useWingman,
} from './messaging-api';

function SheetAction(props: {
  label: string;
  description?: string;
  icon: ChatIconName;
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const tint = props.tone === 'danger' ? color.danger : color.textPrimary;
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      onPress={props.onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <View style={[styles.actionIcon, props.tone === 'danger' && styles.actionIconDanger]}>
        <ChatIcon name={props.icon} color={tint} size={20} />
      </View>
      <View style={styles.actionCopy}>
        <Text variant="bodyStrong" style={{ color: tint }}>
          {props.label}
        </Text>
        {props.description ? (
          <Text variant="caption" tone="textSecondary">
            {props.description}
          </Text>
        ) : null}
      </View>
      <ChatIcon name="chevronRight" color={color.textDisabled} size={16} />
    </Pressable>
  );
}

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
  onSchedule: () => void;
  onVideo: () => void;
  onTextTimer: () => void;
}) {
  return (
    <BottomSheet visible={props.visible} title="Add to the conversation" onClose={props.onClose}>
      <View style={styles.actionList}>
        <SheetAction
          label="Photo"
          description="From your library"
          icon="image"
          onPress={props.onPhoto}
        />
        <SheetAction
          label="Video"
          description="Up to 30 seconds"
          icon="play"
          onPress={props.onVideo}
        />
        <SheetAction
          label="Voice note"
          description="Speak it instead"
          icon="mic"
          onPress={props.onVoice}
        />
        <SheetAction
          label="Date idea"
          description="Suggest something real"
          icon="calendar"
          onPress={props.onPlan}
        />
        <SheetAction
          label="Ask Wingman for ideas"
          description="A little help finding the words"
          icon="sparkle"
          onPress={props.onWingman}
        />
        <SheetAction
          label="Send later"
          description="Choose when it goes"
          icon="clock"
          onPress={props.onSchedule}
        />
        <SheetAction
          label="Self-destructing message"
          description="Disappears after it’s read"
          icon="lock"
          onPress={props.onTextTimer}
        />
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
      <SettingRow
        label={`Show media from ${props.name}`}
        description="Photos, videos and voice notes. Off keeps new ones hidden until you allow them."
        value={settings.mediaConsent === 'allowed'}
        onChange={(v) => props.onChange({ mediaConsent: v ? 'allowed' : 'ask' })}
      />
      <View style={styles.themeBlock}>
        <Text variant="bodyStrong">Disappearing messages</Text>
        <Text variant="caption" tone="textSecondary">
          New messages are erased for both of you this long after they’re sent. Either of you can
          change it.
        </Text>
        <View style={styles.row} role="radiogroup" aria-label="Disappearing messages">
          {([null, ...DISAPPEAR_CHOICES] as const).map((choice) => (
            <ChoiceChip
              key={choice ?? 'off'}
              label={choice === null ? 'Off' : (DISAPPEAR_LABEL[choice] ?? '')}
              selected={settings.disappearSeconds === choice}
              onPress={() => props.onChange({ disappearSeconds: choice })}
            />
          ))}
        </View>
      </View>
      <SettingRow
        label={`Restrict ${props.name}`}
        description="Their messages arrive quietly, with no notifications. They can’t see when you’ve read or are typing. They aren’t told."
        value={settings.restricted}
        onChange={(v) => props.onChange({ restricted: v })}
      />
      <View style={styles.themeBlock}>
        <Text variant="bodyStrong">Theme</Text>
        <Text variant="caption" tone="textSecondary">
          Colours your messages. You both see it, and either of you can change it.
        </Text>
        <View style={styles.themes} role="radiogroup" aria-label="Theme">
          {CHAT_THEMES.map((theme) => (
            <Pressable
              key={theme}
              role="radio"
              aria-checked={settings.theme === theme}
              aria-label={chatThemes[theme].label}
              onPress={() => props.onChange({ theme })}
              style={[
                styles.swatch,
                { backgroundColor: chatThemes[theme].mine },
                settings.theme === theme && styles.swatchChosen,
              ]}
            />
          ))}
        </View>
      </View>
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

/**
 * Everything you can do to one message: react, reply, pin, edit or forward your
 * own text, remove your own, or report theirs (which hides it from you).
 */
export function MessageActionsSheet(props: {
  message: MessageView | null;
  canAct: boolean;
  onClose: () => void;
  onReact: (message: MessageView, emoji: Reaction | null) => void;
  onReply: (message: MessageView) => void;
  onPin: (message: MessageView) => void;
  onEdit: (message: MessageView) => void;
  onForward: (message: MessageView) => void;
  onSave: (message: MessageView) => void;
  onRemove: (message: MessageView) => void;
  onReport: (message: MessageView, reason: (typeof REPORT_REASONS)[number]['value']) => void;
}) {
  const { message } = props;
  const [reporting, setReporting] = useState(false);
  const close = () => {
    setReporting(false);
    props.onClose();
  };
  const myReaction = message?.reactions.find((r) => r.mine)?.emoji ?? null;
  return (
    <BottomSheet
      visible={message !== null}
      title={reporting ? 'Report this message?' : message?.mine ? 'Your message' : 'Message'}
      onClose={close}
    >
      {message && reporting ? (
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
      ) : message ? (
        <>
          {props.canAct ? (
            <View style={styles.reactionRow} role="group" aria-label="React">
              {REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  role="button"
                  aria-label={myReaction === emoji ? `Remove ${emoji}` : `React ${emoji}`}
                  aria-selected={myReaction === emoji}
                  onPress={() => props.onReact(message, myReaction === emoji ? null : emoji)}
                  style={[styles.reaction, myReaction === emoji && styles.reactionChosen]}
                >
                  <Text variant="title">{emoji}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.actionList}>
            {props.canAct ? (
              <>
                <SheetAction label="Reply" icon="reply" onPress={() => props.onReply(message)} />
                <SheetAction
                  label={message.pinned ? 'Unpin' : 'Pin for both of you'}
                  icon="pin"
                  onPress={() => props.onPin(message)}
                />
              </>
            ) : null}
            {props.canAct && message.editable ? (
              <SheetAction label="Edit" icon="edit" onPress={() => props.onEdit(message)} />
            ) : null}
            {props.canAct && message.mine && message.kind === 'text' ? (
              <SheetAction
                label="Forward"
                icon="forward"
                onPress={() => props.onForward(message)}
              />
            ) : null}
            {message.savable ? (
              <SheetAction
                label="Save to your vault"
                icon="lock"
                onPress={() => props.onSave(message)}
              />
            ) : null}
            {message.body ? (
              <SheetAction
                label="Copy text"
                icon="copy"
                onPress={() => {
                  void Clipboard.setStringAsync(message.body ?? '');
                  props.onClose();
                }}
              />
            ) : null}
            {message.mine ? (
              <SheetAction
                label="Remove for both of you"
                icon="trash"
                tone="danger"
                onPress={() => props.onRemove(message)}
              />
            ) : (
              <SheetAction
                label="Report"
                icon="flag"
                tone="danger"
                onPress={() => setReporting(true)}
              />
            )}
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

/** Your own text, to up to five of your other conversations. */
export function ForwardSheet(props: {
  message: MessageView | null;
  fromConversationId: string;
  onClose: () => void;
}) {
  const conversations = useConversations();
  const forward = useForward();
  const [chosen, setChosen] = useState<string[]>([]);
  const targets = (conversations.data?.conversations ?? []).filter(
    (c) => c.id !== props.fromConversationId && !c.readOnly,
  );
  const close = () => {
    setChosen([]);
    forward.reset();
    props.onClose();
  };
  return (
    <BottomSheet visible={props.message !== null} title="Forward to" onClose={close}>
      <Text tone="textSecondary" style={styles.intro}>
        Only your own messages can be forwarded. Photos and voice notes stay where they were sent.
      </Text>
      {targets.length === 0 ? (
        <Text tone="textSecondary">You don’t have other conversations yet.</Text>
      ) : (
        targets.map((c) => (
          <SelectRow
            key={c.id}
            kind="checkbox"
            label={c.person.displayName}
            selected={chosen.includes(c.id)}
            onPress={() =>
              setChosen((list) =>
                list.includes(c.id)
                  ? list.filter((x) => x !== c.id)
                  : list.length >= MAX_FORWARD_TARGETS
                    ? list
                    : [...list, c.id],
              )
            }
          />
        ))
      )}
      <ErrorNotice message={forward.isError ? errorMessage(forward.error) : undefined} />
      <Button
        label={chosen.length > 1 ? `Forward to ${chosen.length}` : 'Forward'}
        disabled={chosen.length === 0}
        loading={forward.isPending}
        style={styles.footnote}
        onPress={() =>
          props.message &&
          forward.mutate(
            { messageId: props.message.id, conversationIds: chosen },
            { onSuccess: close },
          )
        }
      />
    </BottomSheet>
  );
}

function at(daysAhead: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Times to offer: soon, this evening, tomorrow morning, the weekend. */
function scheduleChoices(now = new Date()): { label: string; when: Date }[] {
  const choices = [{ label: 'In 1 hour', when: new Date(now.getTime() + 3_600_000) }];
  const tonight = at(0, 20);
  if (tonight.getTime() - now.getTime() > 3_600_000)
    choices.push({ label: 'Tonight, 8 pm', when: tonight });
  choices.push({ label: 'Tomorrow, 9 am', when: at(1, 9) });
  choices.push({ label: 'Tomorrow, 7 pm', when: at(1, 19) });
  const toSaturday = (6 - now.getDay() + 7) % 7 || 7;
  if (toSaturday > 1) choices.push({ label: 'Saturday, 10 am', when: at(toSaturday, 10) });
  return choices;
}

/** Send the draft later (up to a week ahead), and see or cancel what's waiting. */
export function ScheduleSheet(props: {
  conversationId: string;
  visible: boolean;
  draft: string;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const schedule = useScheduleMessage(props.conversationId);
  const scheduled = useScheduled(props.conversationId, props.visible);
  const cancel = useCancelScheduled(props.conversationId);
  const body = props.draft.trim();
  const waiting = scheduled.data?.scheduled ?? [];
  return (
    <BottomSheet visible={props.visible} title="Send later" onClose={props.onClose}>
      {body ? (
        <>
          <Text tone="textSecondary" numberOfLines={2} style={styles.intro}>
            “{body}”
          </Text>
          <View style={styles.row}>
            {scheduleChoices().map((choice) => (
              <Button
                key={choice.label}
                label={choice.label}
                variant="secondary"
                style={styles.purpose}
                disabled={schedule.isPending}
                onPress={() =>
                  schedule.mutate(
                    { body, sendAt: choice.when.toISOString() },
                    { onSuccess: props.onScheduled },
                  )
                }
              />
            ))}
          </View>
        </>
      ) : (
        <Text tone="textSecondary" style={styles.intro}>
          Write a message first, then choose when it goes.
        </Text>
      )}
      <ErrorNotice message={schedule.isError ? errorMessage(schedule.error) : undefined} />
      {waiting.length > 0 ? (
        <>
          <Text variant="eyebrow" tone="textSecondary" style={styles.footnote}>
            Waiting to send
          </Text>
          {waiting.map((item) => (
            <View key={item.id} style={styles.setting}>
              <View style={styles.settingCopy}>
                <Text numberOfLines={2}>{item.body}</Text>
                <Text
                  variant="caption"
                  tone={item.status === 'FAILED' ? 'danger' : 'textSecondary'}
                >
                  {item.status === 'FAILED'
                    ? 'Couldn’t be sent'
                    : new Date(item.sendAt).toLocaleString([], {
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </Text>
              </View>
              <Button
                label={item.status === 'FAILED' ? 'Dismiss' : 'Cancel'}
                variant="quiet"
                onPress={() => cancel.mutate(item.id)}
              />
            </View>
          ))}
        </>
      ) : null}
    </BottomSheet>
  );
}

/** The conversation's pinned messages. Either person can unpin. */
export function PinnedSheet(props: {
  conversationId: string;
  visible: boolean;
  otherName: string;
  canAct: boolean;
  onClose: () => void;
}) {
  const pinned = usePinned(props.conversationId, props.visible);
  const pin = usePin(props.conversationId);
  return (
    <BottomSheet visible={props.visible} title="Pinned" onClose={props.onClose}>
      {(pinned.data?.messages ?? []).map((m) => (
        <View key={m.id} style={styles.setting}>
          <View style={styles.settingCopy}>
            <Text variant="caption" tone="textSecondary">
              {m.mine ? 'You' : props.otherName}
            </Text>
            <Text numberOfLines={3}>
              {m.body ??
                (m.kind === 'image' ? 'Photo' : m.kind === 'voice' ? 'Voice note' : 'Date idea')}
            </Text>
          </View>
          {props.canAct ? (
            <Button
              label="Unpin"
              variant="quiet"
              onPress={() => pin.mutate({ messageId: m.id, pinned: false })}
            />
          ) : null}
        </View>
      ))}
    </BottomSheet>
  );
}

const DISAPPEAR_LABEL: Readonly<Record<number, string>> = {
  86_400: '24 h',
  604_800: '7 days',
  7_776_000: '90 days',
};

/** Before a photo or video goes: view once, a timer, sensitive, and whether it can be saved. */
export function MediaOptionsSheet(props: {
  kind: 'image' | 'video' | null;
  sending: boolean;
  error: unknown;
  otherName: string;
  onClose: () => void;
  onSend: (protection: MediaProtection) => void;
}) {
  const [p, setP] = useState<MediaProtection>(NO_PROTECTION);
  const ephemeral = p.viewOnce || p.timerSeconds !== null;
  const close = () => {
    setP(NO_PROTECTION);
    props.onClose();
  };
  return (
    <BottomSheet
      visible={props.kind !== null}
      title={props.kind === 'video' ? 'Send video' : 'Send photo'}
      onClose={close}
    >
      <SettingRow
        label="View once"
        description={`${props.otherName} can open it one time; then it’s erased for both of you.`}
        value={p.viewOnce}
        onChange={(v) => setP({ ...p, viewOnce: v, timerSeconds: v ? null : p.timerSeconds })}
      />
      <View style={styles.themeBlock}>
        <Text variant="bodyStrong">Timer</Text>
        <Text variant="caption" tone="textSecondary">
          Erased this long after {props.otherName} first opens it.
        </Text>
        <View style={styles.row} role="radiogroup" aria-label="Timer">
          {([null, ...TIMER_CHOICES] as const).map((t) => (
            <ChoiceChip
              key={t ?? 'off'}
              label={t === null ? 'Off' : timerLabel(t)}
              selected={p.timerSeconds === t}
              disabled={p.viewOnce && t !== null}
              onPress={() => setP({ ...p, timerSeconds: t })}
            />
          ))}
        </View>
      </View>
      <SettingRow
        label="Sensitive"
        description="Blurred until tapped, and marked with their name."
        value={p.sensitive}
        onChange={(v) => setP({ ...p, sensitive: v })}
      />
      <SettingRow
        label="Let them save it"
        description={
          ephemeral
            ? 'View-once and timed media can’t be saved.'
            : `${props.otherName} can keep a copy in their private vault.`
        }
        value={p.allowSave && !ephemeral}
        onChange={(v) => setP({ ...p, allowSave: v })}
      />
      <Text variant="caption" tone="textSecondary" style={styles.footnote}>
        VYRA erases it on time, but can’t stop someone photographing their screen.
      </Text>
      <ErrorNotice message={props.error ? errorMessage(props.error) : undefined} />
      <Button
        label="Send"
        loading={props.sending}
        style={styles.footnote}
        onPress={() => {
          props.onSend(p);
          setP(NO_PROTECTION);
        }}
      />
    </BottomSheet>
  );
}

/** The next text erases itself this long after it's read. */
export function TextTimerSheet(props: {
  visible: boolean;
  value: number | null;
  onClose: () => void;
  onChoose: (seconds: number | null) => void;
}) {
  return (
    <BottomSheet visible={props.visible} title="Self-destructing message" onClose={props.onClose}>
      <Text tone="textSecondary" style={styles.intro}>
        Your next message is erased for both of you this long after they read it.
      </Text>
      <View style={styles.row} role="radiogroup" aria-label="Erase after">
        {([null, ...TIMER_CHOICES] as const).map((t) => (
          <ChoiceChip
            key={t ?? 'off'}
            label={t === null ? 'Off' : timerLabel(t)}
            selected={props.value === t}
            onPress={() => props.onChoose(t)}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: space.l },
  stack: { gap: space.s, marginTop: space.l },
  actionList: { marginTop: space.m },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 58,
    paddingVertical: space.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  actionPressed: { backgroundColor: color.surface },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  actionIconDanger: { backgroundColor: color.surfaceRaised },
  actionCopy: { flex: 1, gap: 1 },
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
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.m,
    paddingHorizontal: space.xs,
    borderRadius: radius.l,
    backgroundColor: color.surface,
  },
  reaction: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionChosen: {
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.chemistryText,
  },
  themeBlock: {
    gap: space.xxs,
    paddingVertical: space.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  themes: { flexDirection: 'row', gap: space.m, marginTop: space.s },
  swatch: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.l,
    borderWidth: 2,
    borderColor: color.border,
  },
  swatchChosen: { borderColor: color.textPrimary },
});

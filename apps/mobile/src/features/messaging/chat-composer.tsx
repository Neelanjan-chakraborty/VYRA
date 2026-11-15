import { color, MIN_TOUCH_TARGET, radius, space, typography } from '@vyra/design-system';
import { MESSAGE_BODY_MAX, type MessageView } from '@vyra/validation';
import { type ComponentRef, type RefObject, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { noBrowserFocusRing } from '@/lib/web-style';
import { ChatIcon } from './chat-icons';
import { timerLabel } from './media-views';
import { clock, type VoiceRecorder } from './voice';

const EMOJI = [
  '❤️',
  '😂',
  '🔥',
  '✨',
  '🥰',
  '😮',
  '😢',
  '👍',
  '🙌',
  '🫶',
  '🌙',
  '☕',
  '🍜',
  '🎶',
  '🌹',
  '🥂',
  '💫',
  '🤍',
  '😅',
  '😭',
  '🫠',
  '🙃',
  '😏',
  '🌿',
] as const;

function previewOf(message: MessageView | null): string {
  if (!message) return '';
  if (message.body) return message.body;
  if (message.kind === 'image') return 'Photo';
  if (message.kind === 'voice') return 'Voice note';
  if (message.kind === 'date_plan') return message.plan?.idea ?? 'Date idea';
  return 'Message';
}

function RecordingDot() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.25, { duration: 700 }), -1, true);
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.recordingDot, style]} aria-hidden />;
}

interface ChatComposerProps {
  readonly draft: string;
  readonly onChangeDraft: (text: string) => void;
  readonly onSend: () => void;
  readonly onAdd: () => void;
  readonly inputRef: RefObject<ComponentRef<typeof TextInput> | null>;
  readonly otherName: string;
  readonly editing: MessageView | null;
  readonly replyTo: MessageView | null;
  readonly aiAssisted: boolean;
  readonly readOnly: boolean;
  readonly sending: boolean;
  readonly recorder: VoiceRecorder;
  readonly onFinishVoice: () => void;
  readonly onCancelVoice: () => void;
  readonly onStopComposing: () => void;
  readonly textTimer: number | null;
  readonly onClearTextTimer: () => void;
  readonly bottomInset: number;
}

/**
 * The bottom of the conversation. One raised shell holds the working controls;
 * the primary action becomes voice when there is nothing to send.
 */
export function ChatComposer({
  draft,
  onChangeDraft,
  onSend,
  onAdd,
  inputRef,
  otherName,
  editing,
  replyTo,
  aiAssisted,
  readOnly,
  sending,
  recorder,
  onFinishVoice,
  onCancelVoice,
  onStopComposing,
  textTimer,
  onClearTextTimer,
  bottomInset,
}: ChatComposerProps) {
  const [focused, setFocused] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const hasText = draft.trim().length > 0;

  const outer = [styles.outer, { paddingBottom: bottomInset + space.s }];

  if (readOnly) {
    return (
      <View style={outer}>
        <View style={[styles.inner, styles.readOnly]}>
          <ChatIcon name="lock" color={color.textSecondary} size={16} />
          <Text tone="textSecondary" style={styles.readOnlyText}>
            This connection has ended. You can read the conversation, but not send messages.
          </Text>
        </View>
      </View>
    );
  }

  if (recorder.recording) {
    return (
      <View style={outer}>
        <View style={styles.inner}>
          <View style={styles.recording}>
            <View style={styles.recordingHead}>
              <RecordingDot />
              <Text variant="bodyStrong" role="timer" aria-live="polite" style={styles.grow}>
                Recording {clock(recorder.elapsedMs)} / 1:00
              </Text>
            </View>
            <View style={styles.recordingActions}>
              <Button label="Cancel" variant="quiet" onPress={onCancelVoice} />
              <Button label="Send voice note" onPress={onFinishVoice} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={outer}>
      <View style={styles.inner}>
        {recorder.denied ? (
          <Text variant="caption" tone="textSecondary">
            Microphone access is off. Turn it on in your device settings to send voice notes.
          </Text>
        ) : null}

        {replyTo || editing ? (
          <View style={styles.context}>
            <View style={styles.contextCopy}>
              <Text variant="captionStrong" tone="textSecondary">
                {editing
                  ? 'Editing your message'
                  : `Replying to ${replyTo?.mine ? 'yourself' : otherName}`}
              </Text>
              {replyTo ? (
                <Text variant="caption" tone="textSecondary" numberOfLines={1}>
                  {previewOf(replyTo)}
                </Text>
              ) : null}
            </View>
            <Pressable
              role="button"
              aria-label={editing ? 'Cancel editing' : 'Cancel reply'}
              onPress={onStopComposing}
              hitSlop={8}
              style={({ pressed }) => [styles.contextCancel, pressed && styles.controlPressed]}
            >
              <ChatIcon name="close" color={color.textSecondary} size={18} />
            </Pressable>
          </View>
        ) : null}

        {aiAssisted ? (
          <Text variant="caption" tone="textSecondary">
            Wingman’s idea — make it yours before sending.
          </Text>
        ) : null}

        {emojiOpen ? (
          <View style={styles.emojiTray} role="group" aria-label="Emoji">
            {EMOJI.map((emoji) => (
              <Pressable
                key={emoji}
                role="button"
                aria-label={`Add ${emoji}`}
                onPress={() => {
                  onChangeDraft(draft + emoji);
                  inputRef.current?.focus();
                }}
                style={({ pressed }) => [styles.emojiCell, pressed && styles.controlPressed]}
              >
                <Text variant="title">{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[styles.shell, focused && styles.shellFocused]}>
          <Pressable
            role="button"
            aria-label="Add a photo, voice note, date idea or ask Wingman"
            onPress={onAdd}
            style={({ pressed }) => [styles.add, pressed && styles.controlPressed]}
          >
            <ChatIcon name="plus" color={color.textPrimary} size={20} />
          </Pressable>

          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={onChangeDraft}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Message"
            placeholderTextColor={color.textDisabled}
            selectionColor={color.accent}
            multiline
            maxLength={MESSAGE_BODY_MAX}
            aria-label="Message"
            style={[styles.input, noBrowserFocusRing]}
          />

          <Pressable
            role="button"
            aria-label="Emoji"
            aria-selected={emojiOpen}
            onPress={() => setEmojiOpen((open) => !open)}
            style={({ pressed }) => [
              styles.control,
              emojiOpen && styles.controlActive,
              pressed && styles.controlPressed,
            ]}
          >
            <ChatIcon
              name="emoji"
              color={emojiOpen ? color.textPrimary : color.textSecondary}
              size={22}
            />
          </Pressable>

          {hasText || editing ? (
            <Pressable
              role="button"
              aria-label={editing ? 'Save' : 'Send'}
              aria-disabled={!hasText}
              disabled={!hasText}
              onPress={onSend}
              style={({ pressed }) => [
                styles.primary,
                !hasText && styles.primaryDisabled,
                pressed && hasText && styles.primaryPressed,
              ]}
            >
              <ChatIcon name="send" color={color.textOnAccent} size={20} />
            </Pressable>
          ) : (
            <Pressable
              role="button"
              aria-label="Record voice note"
              onPress={() => void recorder.start()}
              style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
            >
              <ChatIcon name="mic" color={color.textOnAccent} size={20} />
            </Pressable>
          )}
        </View>

        {textTimer ? (
          <View style={styles.context}>
            <Text variant="caption" tone="chemistryText" style={styles.contextCopy}>
              Your next message disappears {timerLabel(textTimer)} after it’s read
            </Text>
            <Pressable
              role="button"
              aria-label="Cancel disappearing message"
              onPress={onClearTextTimer}
              hitSlop={8}
              style={({ pressed }) => [styles.contextCancel, pressed && styles.controlPressed]}
            >
              <ChatIcon name="close" color={color.textSecondary} size={18} />
            </Pressable>
          </View>
        ) : null}

        {sending ? (
          <Text variant="caption" tone="textSecondary">
            Sending…
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: color.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingHorizontal: space.l,
    paddingTop: space.s,
  },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space.s },
  shell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.xxs,
    padding: space.xs,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  shellFocused: { borderColor: color.textDisabled },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceRaised,
  },
  input: {
    ...typography.message,
    flex: 1,
    minHeight: 40,
    maxHeight: 132,
    paddingHorizontal: space.s,
    paddingVertical: space.s,
    color: color.textPrimary,
    textAlignVertical: 'center',
  },
  control: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { backgroundColor: color.surfaceRaised },
  controlPressed: { opacity: 0.72 },
  primary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accent,
  },
  primaryPressed: { backgroundColor: color.accentPressed },
  primaryDisabled: { opacity: 0.38 },
  emojiTray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xxs,
    padding: space.s,
    borderRadius: radius.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingLeft: space.m,
    borderLeftWidth: 2,
    borderLeftColor: color.chemistryText,
  },
  contextCopy: { flex: 1, minWidth: 0, gap: 1 },
  contextCancel: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingVertical: space.m,
  },
  readOnlyText: { flex: 1 },
  recording: { gap: space.m },
  recordingHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.danger,
  },
  recordingActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.s },
  grow: { flex: 1 },
});

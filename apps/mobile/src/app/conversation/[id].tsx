import { color, MIN_TOUCH_TARGET, radius, space, typography } from '@vyra/design-system';
import { MESSAGE_BODY_MAX, type MessageView } from '@vyra/validation';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { useBlock, useEndConnection, useRelationship } from '@/features/discovery/discovery-api';
import { PersonAvatar } from '@/features/discovery/person-avatar';
import {
  AddSheet,
  MessageActionsSheet,
  PlanSheet,
  SettingsSheet,
  WingmanSheet,
} from '@/features/messaging/conversation-sheets';
import { MessageBubble } from '@/features/messaging/message-bubble';
import {
  newClientId,
  useConversation,
  useConversationSettings,
  useMarkRead,
  useMessages,
  usePlanResponse,
  useRemoveMessage,
  useReportMessage,
  useSendPhoto,
  useSendText,
  useSendVoice,
} from '@/features/messaging/messaging-api';
import { sendTyping, useIsTyping } from '@/features/messaging/realtime';
import { clock, useVoiceRecorder } from '@/features/messaging/voice';
import { errorMessage } from '@/lib/api';
import { prepareImageForUpload } from '@/lib/prepare-image';
import { noBrowserFocusRing } from '@/lib/web-style';

type Sheet = 'add' | 'plan' | 'wingman' | 'settings' | 'end' | 'block' | null;

const TYPING_SIGNAL_MS = 2000;

/** A conversation between two mutual connections. */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const conversation = useConversation(id);
  const summary = conversation.data;
  // Set as soon as a block is confirmed, so nothing re-fetches a conversation that is now hidden.
  const [gone, setGone] = useState(false);
  const messages = useMessages(id, !gone);
  const relationship = useRelationship(summary?.person.userId ?? '', !gone);
  const sendText = useSendText(id);
  const sendPhoto = useSendPhoto(id);
  const sendVoice = useSendVoice(id);
  const markRead = useMarkRead(id);
  const settings = useConversationSettings(id);
  const remove = useRemoveMessage(id);
  const report = useReportMessage(id);
  const plan = usePlanResponse(id);
  const end = useEndConnection();
  const block = useBlock();
  const recorder = useVoiceRecorder();
  const typing = useIsTyping(id);

  const [draft, setDraft] = useState('');
  const [aiAssisted, setAiAssisted] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [actionsFor, setActionsFor] = useState<MessageView | null>(null);
  const lastTyping = useRef(0);
  const lastRead = useRef<string | null>(null);

  const list = useMemo(
    () => messages.data?.pages.flatMap((page) => page.messages) ?? [],
    [messages.data],
  );
  const pendingIds = new Set(
    sendText.isPending && sendText.variables ? [sendText.variables.clientId] : [],
  );

  // Reading the newest message from them marks the conversation read.
  const newestTheirs = list.find((m) => !m.mine && m.kind !== 'system');
  useEffect(() => {
    if (!newestTheirs || lastRead.current === newestTheirs.id) return;
    lastRead.current = newestTheirs.id;
    markRead.mutate(newestTheirs.id);
  }, [newestTheirs, markRead]);

  // Stop recording at the one-minute limit and send what there is.
  useEffect(() => {
    if (recorder.atLimit) void finishVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the limit is reached
  }, [recorder.atLimit]);

  const name = summary?.person.displayName ?? '';
  const readOnly = summary?.readOnly ?? false;
  const error = [sendText, sendPhoto, sendVoice, remove, report, plan, settings].find(
    (m) => m.isError,
  )?.error;

  function onChangeDraft(text: string) {
    setDraft(text);
    if (text.length === 0) setAiAssisted(false);
    if (Date.now() - lastTyping.current > TYPING_SIGNAL_MS) {
      lastTyping.current = Date.now();
      sendTyping(id);
    }
  }

  function send() {
    const body = draft.trim();
    if (!body) return;
    sendText.mutate({ body, clientId: newClientId(), aiAssisted });
    setDraft('');
    setAiAssisted(false);
  }

  async function pickPhoto() {
    setSheet(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    sendPhoto.mutate(await prepareImageForUpload(asset));
  }

  async function startVoice() {
    setSheet(null);
    await recorder.start();
  }

  async function finishVoice() {
    const recording = await recorder.stop();
    if (recording) sendVoice.mutate(recording);
  }

  if (conversation.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.textSecondary} />
      </View>
    );
  }
  if (!summary) {
    return (
      <View style={[styles.center, { padding: space.xl }]}>
        <Text variant="title">This conversation isn’t available.</Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} style={styles.gap} />
      </View>
    );
  }

  const matchId = relationship.data?.matchId ?? null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
        <Pressable
          role="button"
          aria-label="Back"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.icon}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M14.5 5.5L8 12l6.5 6.5"
              stroke={color.textPrimary}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Pressable
          role="link"
          aria-label={`${name}. View profile`}
          onPress={() => router.push(`/person/${summary.person.userId}`)}
          style={styles.who}
        >
          <PersonAvatar name={name} photoUrl={summary.person.photoUrl} size={36} round />
          <View style={styles.whoCopy}>
            <Text variant="title" numberOfLines={1} accessibilityRole="header">
              {name}
            </Text>
            <Text variant="caption" tone={typing ? 'chemistryText' : 'textSecondary'}>
              {readOnly ? 'Connection ended' : typing ? 'typing…' : (summary.person.city ?? ' ')}
            </Text>
          </View>
        </Pressable>
        <Pressable
          role="button"
          aria-label="Conversation settings"
          onPress={() => setSheet('settings')}
          hitSlop={12}
          style={styles.icon}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24">
            {[6, 12, 18].map((cx) => (
              <Circle key={cx} cx={cx} cy={12} r={1.6} fill={color.textPrimary} />
            ))}
          </Svg>
        </Pressable>
      </View>

      <FlatList
        inverted
        data={list}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            otherName={name}
            pending={pendingIds.has(item.id)}
            canAct={!readOnly}
            onActions={setActionsFor}
            onPlan={(message, action) => plan.mutate({ messageId: message.id, action })}
          />
        )}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          messages.isPending || messages.isFetchingNextPage ? (
            <ActivityIndicator color={color.textSecondary} style={styles.gap} />
          ) : undefined
        }
        aria-label={`Conversation with ${name}`}
      />

      {error ? (
        <View style={styles.errorBar}>
          <ErrorNotice message={errorMessage(error)} />
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: insets.bottom + space.s }]}>
        {readOnly ? (
          <Text tone="textSecondary" style={styles.readOnly}>
            This connection has ended. You can read the conversation, but not send messages.
          </Text>
        ) : recorder.recording ? (
          <View style={styles.composerRow}>
            <View style={styles.recordingDot} />
            <Text style={styles.grow} role="timer" aria-live="polite">
              Recording {clock(recorder.elapsedMs)} / 1:00
            </Text>
            <Button label="Cancel" variant="quiet" onPress={() => void recorder.cancel()} />
            <Button label="Send voice note" onPress={() => void finishVoice()} />
          </View>
        ) : (
          <>
            {recorder.denied ? (
              <Text variant="caption" tone="textSecondary">
                Microphone access is off. Turn it on in your device settings to send voice notes.
              </Text>
            ) : null}
            {aiAssisted ? (
              <Text variant="caption" tone="textSecondary">
                Wingman’s idea — make it yours before sending.
              </Text>
            ) : null}
            <View style={styles.composerRow}>
              <Pressable
                role="button"
                aria-label="Add a photo, voice note, date idea or ask Wingman"
                onPress={() => setSheet('add')}
                style={styles.add}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path
                    d="M12 5v14M5 12h14"
                    stroke={color.textPrimary}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                placeholder="Write a message"
                placeholderTextColor={color.textDisabled}
                selectionColor={color.accent}
                multiline
                maxLength={MESSAGE_BODY_MAX}
                aria-label="Message"
                style={[styles.input, noBrowserFocusRing]}
              />
              <Button
                label="Send"
                disabled={draft.trim().length === 0}
                onPress={send}
                style={styles.send}
              />
            </View>
            {sendPhoto.isPending || sendVoice.isPending ? (
              <Text variant="caption" tone="textSecondary">
                Sending…
              </Text>
            ) : null}
          </>
        )}
      </View>

      <AddSheet
        visible={sheet === 'add'}
        onClose={() => setSheet(null)}
        onPhoto={() => void pickPhoto()}
        onVoice={() => void startVoice()}
        onPlan={() => setSheet('plan')}
        onWingman={() => setSheet('wingman')}
      />
      <PlanSheet conversationId={id} visible={sheet === 'plan'} onClose={() => setSheet(null)} />
      <WingmanSheet
        conversationId={id}
        visible={sheet === 'wingman'}
        onClose={() => setSheet(null)}
        onChoose={(text) => {
          setDraft(text);
          setAiAssisted(true);
        }}
      />
      <SettingsSheet
        visible={sheet === 'settings'}
        onClose={() => setSheet(null)}
        settings={summary.settings}
        onChange={(update) => settings.mutate(update)}
        name={name}
        onProfile={() => {
          setSheet(null);
          router.push(`/person/${summary.person.userId}`);
        }}
        onEnd={!readOnly && matchId ? () => setSheet('end') : null}
        onBlock={() => setSheet('block')}
      />
      <MessageActionsSheet
        message={actionsFor}
        onClose={() => setActionsFor(null)}
        onRemove={(message) => remove.mutate(message.id, { onSuccess: () => setActionsFor(null) })}
        onReport={(message, reason) =>
          report.mutate(
            { reportedUserId: summary.person.userId, messageId: message.id, reason },
            { onSuccess: () => setActionsFor(null) },
          )
        }
      />
      <BottomSheet
        visible={sheet === 'end'}
        title="End this connection?"
        onClose={() => setSheet(null)}
      >
        <Text tone="textSecondary" style={styles.sheetIntro}>
          You’ll both keep this conversation to read, but neither of you can send anything. {name}{' '}
          won’t be told why.
        </Text>
        <Button
          label="End connection"
          variant="danger"
          loading={end.isPending}
          onPress={() =>
            matchId &&
            end.mutate(
              { matchId, userId: summary.person.userId },
              { onSuccess: () => setSheet(null) },
            )
          }
        />
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'block'}
        title={`Block ${name}?`}
        onClose={() => setSheet(null)}
      >
        <Text tone="textSecondary" style={styles.sheetIntro}>
          You won’t see each other anywhere in VYRA, including this conversation. They aren’t told.
          You can unblock from Settings.
        </Text>
        <Button
          label="Block"
          variant="danger"
          loading={block.isPending}
          onPress={() => {
            setGone(true);
            block.mutate(
              { userId: summary.person.userId, blocked: true },
              {
                onSuccess: () => {
                  setSheet(null);
                  router.replace('/(tabs)/messages');
                },
                onError: () => setGone(false),
              },
            );
          }}
        />
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background,
  },
  gap: { marginTop: space.l },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.l,
    paddingBottom: space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  icon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m },
  whoCopy: { flex: 1 },
  list: {
    paddingHorizontal: space.l,
    paddingVertical: space.l,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  errorBar: { paddingHorizontal: space.l },
  composer: {
    paddingHorizontal: space.l,
    paddingTop: space.s,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s },
  add: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    maxHeight: 140,
    color: color.textPrimary,
    backgroundColor: color.surface,
    borderRadius: radius.l,
    paddingHorizontal: space.m,
    paddingVertical: space.s + space.xxs,
  },
  send: { paddingHorizontal: space.l },
  readOnly: { paddingVertical: space.m },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.danger },
  grow: { flex: 1 },
  sheetIntro: { marginBottom: space.l },
});

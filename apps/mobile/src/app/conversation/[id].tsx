import { color, space } from '@vyra/design-system';
import type { MessageView } from '@vyra/validation';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { useBlock, useEndConnection, useRelationship } from '@/features/discovery/discovery-api';
import { ChatComposer } from '@/features/messaging/chat-composer';
import { ChatDateSeparator, ChatNewSeparator } from '@/features/messaging/chat-date-separator';
import { ChatEmpty } from '@/features/messaging/chat-empty';
import { ChatHeader } from '@/features/messaging/chat-header';
import { ChatIcon } from '@/features/messaging/chat-icons';
import { ChatSkeleton } from '@/features/messaging/chat-skeleton';
import {
  AddSheet,
  ForwardSheet,
  MediaOptionsSheet,
  MessageActionsSheet,
  PinnedSheet,
  PlanSheet,
  ScheduleSheet,
  SettingsSheet,
  TextTimerSheet,
  WingmanSheet,
} from '@/features/messaging/conversation-sheets';
import { MessageBubble } from '@/features/messaging/message-bubble';
import {
  newClientId,
  useConversation,
  useConversationSettings,
  useEditMessage,
  useMarkRead,
  useMessages,
  usePin,
  usePinned,
  usePlanResponse,
  useReaction,
  useRemoveMessage,
  useReportMessage,
  useSendPhoto,
  useSendText,
  useSendVoice,
  useSendVideo,
  useOpenMedia,
  useCloseMedia,
  useSaveToVault,
  type MediaProtection,
  type PickedMedia,
} from '@/features/messaging/messaging-api';
import { PinnedBanner } from '@/features/messaging/pinned-banner';
import { ProtectedViewer } from '@/features/messaging/protected-viewer';
import { sendTyping, useIsTyping } from '@/features/messaging/realtime';
import { buildChatRows, type ChatRow } from '@/features/messaging/chat-timeline';
import { useVoiceRecorder } from '@/features/messaging/voice';
import { errorMessage } from '@/lib/api';
import { prepareImageForUpload } from '@/lib/prepare-image';

type Sheet =
  | 'add'
  | 'plan'
  | 'wingman'
  | 'settings'
  | 'schedule'
  | 'pinned'
  | 'textTimer'
  | 'end'
  | 'block'
  | null;

/** A photo or video picked and waiting for its send options. */
interface PendingMedia {
  readonly kind: 'image' | 'video';
  readonly media: PickedMedia;
}

const TYPING_SIGNAL_MS = 2000;
const NEAR_BOTTOM_PX = 72;

/** A conversation between two mutual connections. */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const listRef = useRef<FlatList<ChatRow>>(null);
  const conversation = useConversation(id);
  const summary = conversation.data;
  // Set as soon as a block is confirmed, so nothing re-fetches a conversation that is now hidden.
  const [gone, setGone] = useState(false);
  const messages = useMessages(id, !gone);
  const relationship = useRelationship(summary?.person.userId ?? '', !gone);
  const sendText = useSendText(id);
  const sendPhoto = useSendPhoto(id);
  const sendVoice = useSendVoice(id);
  const sendVideo = useSendVideo(id);
  const openMedia = useOpenMedia(id);
  const closeMedia = useCloseMedia(id);
  const saveToVault = useSaveToVault();
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [viewing, setViewing] = useState<MessageView | null>(null);
  const [textTimer, setTextTimer] = useState<number | null>(null);
  const markRead = useMarkRead(id);
  const settings = useConversationSettings(id);
  const remove = useRemoveMessage(id);
  const report = useReportMessage(id);
  const plan = usePlanResponse(id);
  const react = useReaction(id);
  const pin = usePin(id);
  const edit = useEditMessage(id);
  const pinned = usePinned(id, !gone);
  const end = useEndConnection();
  const block = useBlock();
  const recorder = useVoiceRecorder();
  const typing = useIsTyping(id);

  const [draft, setDraft] = useState('');
  const [aiAssisted, setAiAssisted] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [actionsFor, setActionsFor] = useState<MessageView | null>(null);
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [editing, setEditing] = useState<MessageView | null>(null);
  const [forwarding, setForwarding] = useState<MessageView | null>(null);
  const [awayCount, setAwayCount] = useState(0);
  const [newSinceId, setNewSinceId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const lastTyping = useRef(0);
  const lastRead = useRef<string | null>(null);
  const newestTheirId = useRef<string | null>(null);
  const nearBottom = useRef(true);

  const list = useMemo(
    () => messages.data?.pages.flatMap((page) => page.messages) ?? [],
    [messages.data],
  );
  const pendingIds = useMemo(
    () => new Set(sendText.isPending && sendText.variables ? [sendText.variables.clientId] : []),
    [sendText.isPending, sendText.variables],
  );
  const rows = useMemo(
    () => buildChatRows(list, { newSinceId, pendingIds }),
    [list, newSinceId, pendingIds],
  );

  // Seeing the newest message from them marks the conversation read. A reader
  // who is up the history has not seen it yet.
  const newestTheirs = list.find((m) => !m.mine && m.kind !== 'system');
  useEffect(() => {
    if (!atBottom || !newestTheirs || lastRead.current === newestTheirs.id) return;
    lastRead.current = newestTheirs.id;
    markRead.mutate(newestTheirs.id);
  }, [atBottom, newestTheirs, markRead]);

  // Stop recording at the one-minute limit and send what there is.
  useEffect(() => {
    if (recorder.atLimit) void finishVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the limit is reached
  }, [recorder.atLimit]);

  // If something arrives while the reader is up the history, leave a marker.
  useEffect(() => {
    const newest = list.find((m) => !m.mine && m.kind !== 'system');
    if (!newest) return;
    const previous = newestTheirId.current;
    if (!previous) {
      newestTheirId.current = newest.id;
      return;
    }
    if (previous === newest.id) return;
    const index = list.findIndex((m) => m.id === previous);
    const fresh =
      index > 0 ? list.slice(0, index).filter((m) => !m.mine && m.kind !== 'system') : [];
    newestTheirId.current = newest.id;
    if (fresh.length === 0 || nearBottom.current) return;
    const oldestFresh = fresh[fresh.length - 1];
    if (!oldestFresh) return;
    setNewSinceId(oldestFresh.id);
    setAwayCount((count) => count + fresh.length);
  }, [list]);

  const name = summary?.person.displayName ?? '';
  const readOnly = summary?.readOnly ?? false;
  const error = [
    sendText,
    sendPhoto,
    sendVoice,
    saveToVault,
    remove,
    report,
    plan,
    settings,
    react,
    pin,
    edit,
  ].find((m) => m.isError)?.error;

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
    if (editing) {
      edit.mutate({ messageId: editing.id, body });
      setEditing(null);
    } else {
      sendText.mutate({
        body,
        clientId: newClientId(),
        aiAssisted,
        ...(textTimer ? { timerSeconds: textTimer } : {}),
        ...(replyTo
          ? {
              replyToId: replyTo.id,
              replyTo: { id: replyTo.id, mine: replyTo.mine, preview: replyTo.body ?? '' },
            }
          : {}),
      });
      setReplyTo(null);
      setTextTimer(null);
    }
    setDraft('');
    setAiAssisted(false);
  }

  function startReply(message: MessageView) {
    setActionsFor(null);
    setEditing(null);
    setReplyTo(message);
    inputRef.current?.focus();
  }

  function startEdit(message: MessageView) {
    setActionsFor(null);
    setReplyTo(null);
    setEditing(message);
    setDraft(message.body ?? '');
    inputRef.current?.focus();
  }

  function stopComposing() {
    if (editing) setDraft('');
    setEditing(null);
    setReplyTo(null);
  }

  async function pickPhoto() {
    setSheet(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setPendingMedia({ kind: 'image', media: await prepareImageForUpload(asset) });
  }

  async function pickVideo() {
    setSheet(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setPendingMedia({
      kind: 'video',
      media: {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'video/mp4',
        ...(asset.file ? { file: asset.file } : {}),
      },
    });
  }

  function sendPending(protection: MediaProtection) {
    if (!pendingMedia) return;
    const mutation = pendingMedia.kind === 'video' ? sendVideo : sendPhoto;
    mutation.mutate(
      { media: pendingMedia.media, protection },
      { onSuccess: () => setPendingMedia(null) },
    );
  }

  function open(message: MessageView) {
    setViewing(null);
    openMedia.mutate(message.id, { onSuccess: (opened) => setViewing(opened) });
  }

  function closeViewer() {
    // A view-once item is erased as soon as it is closed.
    if (viewing?.viewOnce) closeMedia.mutate(viewing.id);
    setViewing(null);
    openMedia.reset();
  }

  async function startVoice() {
    setSheet(null);
    await recorder.start();
  }

  async function finishVoice() {
    const recording = await recorder.stop();
    if (recording) sendVoice.mutate(recording);
  }

  function jumpToLatest() {
    listRef.current?.scrollToOffset({ offset: 0, animated: !reduceMotion });
    nearBottom.current = true;
    setAtBottom(true);
    setAwayCount(0);
    setNewSinceId(null);
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextAtBottom = event.nativeEvent.contentOffset.y <= NEAR_BOTTOM_PX;
    nearBottom.current = nextAtBottom;
    setAtBottom((current) => (current === nextAtBottom ? current : nextAtBottom));
    if (!nextAtBottom) return;
    setAwayCount((count) => (count === 0 ? count : 0));
    setNewSinceId((current) => (current === null ? current : null));
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
  const theme = summary.settings.theme;
  const pinnedMessages = pinned.data?.messages ?? [];
  const sending =
    sendText.isPending || sendPhoto.isPending || sendVoice.isPending || sendVideo.isPending;

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <ChatHeader
        name={name}
        photoUrl={summary.person.photoUrl}
        city={summary.person.city}
        typing={typing}
        readOnly={readOnly}
        onBack={() => router.back()}
        onProfile={() => router.push(`/person/${summary.person.userId}`)}
        onSettings={() => setSheet('settings')}
      />

      <PinnedBanner messages={pinnedMessages} onPress={() => setSheet('pinned')} />

      <View style={styles.listWrap}>
        {messages.isPending && list.length === 0 ? <ChatSkeleton /> : null}

        {!messages.isPending && messages.isError && list.length === 0 ? (
          <View style={styles.statePanel}>
            <ErrorNotice message={errorMessage(messages.error)} />
            <Button label="Try again" variant="secondary" onPress={() => void messages.refetch()} />
          </View>
        ) : null}

        {!messages.isPending && !messages.isError && list.length === 0 ? (
          <ChatEmpty
            name={name}
            photoUrl={summary.person.photoUrl}
            onStarter={(text) => {
              setDraft(text);
              inputRef.current?.focus();
            }}
          />
        ) : null}

        {list.length > 0 ? (
          <FlatList
            ref={listRef}
            inverted
            data={rows}
            keyExtractor={(row) => row.message.id}
            contentContainerStyle={styles.list}
            scrollEventThrottle={16}
            onScroll={onScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            initialNumToRender={14}
            renderItem={({ item }) => (
              <View>
                {item.showDate ? <ChatDateSeparator iso={item.message.createdAt} /> : null}
                {item.showNew ? <ChatNewSeparator /> : null}
                <MessageBubble
                  message={item.message}
                  otherName={name}
                  otherPhotoUrl={summary.person.photoUrl}
                  pending={pendingIds.has(item.message.id)}
                  canAct={!readOnly}
                  onActions={setActionsFor}
                  onPlan={(message, action) => plan.mutate({ messageId: message.id, action })}
                  onReact={(message, emoji) => react.mutate({ messageId: message.id, emoji })}
                  theme={theme}
                  firstOfGroup={item.firstOfGroup}
                  lastOfGroup={item.lastOfGroup}
                  showAvatar={item.showAvatar}
                  showMeta={item.showMeta}
                  onOpen={open}
                  onAllowMedia={
                    readOnly ? null : () => settings.mutate({ mediaConsent: 'allowed' })
                  }
                />
              </View>
            )}
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage)
                void messages.fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              messages.isFetchingNextPage ? (
                <ActivityIndicator color={color.textSecondary} style={styles.gap} />
              ) : undefined
            }
            aria-label={`Conversation with ${name}`}
          />
        ) : null}

        {awayCount > 0 ? (
          <Pressable
            role="button"
            aria-label="Jump to latest messages"
            onPress={jumpToLatest}
            style={({ pressed }) => [styles.jump, pressed && styles.jumpPressed]}
          >
            <ChatIcon name="chevronDown" color={color.textPrimary} size={16} />
            <Text variant="captionStrong">
              {awayCount === 1 ? 'New message' : `${awayCount} new messages`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <ErrorNotice message={errorMessage(error)} />
        </View>
      ) : null}

      <ChatComposer
        draft={draft}
        onChangeDraft={onChangeDraft}
        onSend={send}
        onAdd={() => setSheet('add')}
        inputRef={inputRef}
        otherName={name}
        editing={editing}
        replyTo={replyTo}
        aiAssisted={aiAssisted}
        readOnly={readOnly}
        sending={sending}
        recorder={recorder}
        onFinishVoice={() => void finishVoice()}
        onCancelVoice={() => void recorder.cancel()}
        onStopComposing={stopComposing}
        textTimer={textTimer}
        onClearTextTimer={() => setTextTimer(null)}
        bottomInset={insets.bottom}
      />

      <AddSheet
        visible={sheet === 'add'}
        onClose={() => setSheet(null)}
        onPhoto={() => void pickPhoto()}
        onVoice={() => void startVoice()}
        onPlan={() => setSheet('plan')}
        onWingman={() => setSheet('wingman')}
        onSchedule={() => setSheet('schedule')}
        onVideo={() => void pickVideo()}
        onTextTimer={() => setSheet('textTimer')}
      />
      <TextTimerSheet
        visible={sheet === 'textTimer'}
        value={textTimer}
        onClose={() => setSheet(null)}
        onChoose={(seconds) => {
          setTextTimer(seconds);
          setSheet(null);
          inputRef.current?.focus();
        }}
      />
      <MediaOptionsSheet
        kind={pendingMedia?.kind ?? null}
        otherName={name}
        sending={sendPhoto.isPending || sendVideo.isPending}
        error={sendPhoto.error ?? sendVideo.error}
        onClose={() => {
          setPendingMedia(null);
          sendPhoto.reset();
          sendVideo.reset();
        }}
        onSend={sendPending}
      />
      <ProtectedViewer
        message={viewing}
        loading={openMedia.isPending}
        error={openMedia.error}
        otherName={name}
        onClose={closeViewer}
      />
      <ScheduleSheet
        conversationId={id}
        visible={sheet === 'schedule'}
        draft={draft}
        onClose={() => setSheet(null)}
        onScheduled={() => {
          setDraft('');
          setSheet(null);
        }}
      />
      <PinnedSheet
        conversationId={id}
        visible={sheet === 'pinned'}
        otherName={name}
        canAct={!readOnly}
        onClose={() => setSheet(null)}
      />
      <ForwardSheet
        message={forwarding}
        fromConversationId={id}
        onClose={() => setForwarding(null)}
      />
      <PlanSheet conversationId={id} visible={sheet === 'plan'} onClose={() => setSheet(null)} />
      <WingmanSheet
        conversationId={id}
        visible={sheet === 'wingman'}
        onClose={() => setSheet(null)}
        onChoose={(text) => {
          setDraft(text);
          setAiAssisted(true);
          inputRef.current?.focus();
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
        canAct={!readOnly}
        onClose={() => setActionsFor(null)}
        onReact={(message, emoji) =>
          react.mutate({ messageId: message.id, emoji }, { onSuccess: () => setActionsFor(null) })
        }
        onReply={startReply}
        onPin={(message) =>
          pin.mutate(
            { messageId: message.id, pinned: !message.pinned },
            { onSuccess: () => setActionsFor(null) },
          )
        }
        onEdit={startEdit}
        onSave={(message) =>
          saveToVault.mutate(message.id, { onSuccess: () => setActionsFor(null) })
        }
        onForward={(message) => {
          setActionsFor(null);
          setForwarding(message);
        }}
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
  listWrap: { flex: 1, position: 'relative' },
  list: {
    paddingHorizontal: space.l,
    paddingVertical: space.l,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  statePanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.xl,
  },
  errorBar: {
    paddingHorizontal: space.l,
    paddingBottom: space.xs,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  jump: {
    position: 'absolute',
    right: space.l,
    bottom: space.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.m,
    borderRadius: 20,
    backgroundColor: color.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  jumpPressed: { backgroundColor: color.surface },
  sheetIntro: { marginBottom: space.l },
});

import { color, space } from '@vyra/design-system';
import type { ConversationSummary } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { PersonAvatar } from '@/features/discovery/person-avatar';
import { useConversations } from '@/features/messaging/messaging-api';
import { errorMessage } from '@/lib/api';

function when(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function Row({ conversation }: { conversation: ConversationSummary }) {
  const router = useRouter();
  const { person, lastMessage } = conversation;
  const preview = lastMessage
    ? `${lastMessage.mine ? 'You: ' : ''}${lastMessage.preview}`
    : 'Say hello';
  const state = [conversation.unread ? 'new message' : null, conversation.readOnly ? 'ended' : null]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      role="link"
      aria-label={`${person.displayName}${state ? `, ${state}` : ''}. ${preview}. Open conversation`}
      onPress={() => router.push(`/conversation/${conversation.id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.surface }]}
    >
      <PersonAvatar name={person.displayName} photoUrl={person.photoUrl} size={52} round />
      <View style={styles.copy}>
        <View style={styles.head}>
          <Text variant="title" numberOfLines={1} style={styles.name}>
            {person.displayName}
          </Text>
          {lastMessage ? (
            <Text variant="caption" tone="textSecondary">
              {when(lastMessage.at)}
            </Text>
          ) : null}
        </View>
        <View style={styles.head}>
          <Text
            variant="caption"
            tone={conversation.unread ? 'textPrimary' : 'textSecondary'}
            numberOfLines={1}
            style={styles.preview}
          >
            {conversation.readOnly ? 'Connection ended · ' : ''}
            {preview}
          </Text>
          {conversation.unread ? <View style={styles.dot} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Conversations with mutual connections. Quiet: a dot for something new, no counts. */
export default function MessagesScreen() {
  const router = useRouter();
  const conversations = useConversations();
  const list = conversations.data?.conversations ?? [];

  return (
    <Screen
      eyebrow="Messages"
      title={list.length > 0 ? 'Your conversations.' : 'No conversations yet.'}
    >
      {conversations.isPending ? <ActivityIndicator color={color.textSecondary} /> : null}
      {conversations.isError ? (
        <>
          <ErrorNotice message={errorMessage(conversations.error)} />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void conversations.refetch()}
          />
        </>
      ) : null}
      {conversations.data && list.length === 0 ? (
        <>
          <Text tone="textSecondary">
            A conversation opens when a connection is mutual. Until then, there is nothing to say.
          </Text>
          <Button
            label="See your connections"
            variant="secondary"
            onPress={() => router.push('/(tabs)/connections')}
            style={styles.empty}
          />
        </>
      ) : null}
      {list.map((conversation) => (
        <Row key={conversation.id} conversation={conversation} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignSelf: 'flex-start', marginTop: space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.l,
    paddingVertical: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  copy: { flex: 1, gap: space.xxs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  name: { flex: 1 },
  preview: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.chemistryText },
});

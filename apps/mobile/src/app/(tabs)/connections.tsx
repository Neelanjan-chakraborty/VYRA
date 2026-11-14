import { color, space } from '@vyra/design-system';
import type { ConnectionItem } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ModeSwitch } from '@/components/ui/mode-switch';
import { ErrorNotice } from '@/components/ui/notice';
import {
  alignmentWords,
  useConnections,
  useEndConnection,
  useRespond,
  useSave,
} from '@/features/discovery/discovery-api';
import { PersonAvatar } from '@/features/discovery/person-avatar';
import { errorMessage } from '@/lib/api';

type Section = 'incoming' | 'outgoing' | 'mutual' | 'saved';

const SECTIONS: readonly { value: Section; label: string }[] = [
  { value: 'incoming', label: 'Requests' },
  { value: 'outgoing', label: 'Sent' },
  { value: 'mutual', label: 'Mutual' },
  { value: 'saved', label: 'Saved' },
];

const EMPTY: Readonly<Record<Section, string>> = {
  incoming: 'No one has asked to connect yet. Requests people send you will wait here.',
  outgoing: 'You haven’t asked anyone to connect. Requests you send wait here until answered.',
  mutual: 'No mutual connections yet. When someone accepts, or you accept them, they appear here.',
  saved: 'Nothing saved. Save someone from their profile to come back to them later.',
};

function Row({
  item,
  section,
  onEnd,
}: {
  item: ConnectionItem;
  section: Section;
  onEnd: (item: ConnectionItem) => void;
}) {
  const router = useRouter();
  const respond = useRespond();
  const save = useSave();
  const { person } = item;
  const meta = [person.age, person.city, person.distance].filter(Boolean).join(' · ');
  const userId = person.userId;
  const requestId = item.id;

  return (
    <View style={styles.row}>
      <Pressable
        role="link"
        aria-label={`${person.displayName}, ${meta}. Open profile`}
        onPress={() => router.push(`/person/${userId}`)}
        style={({ pressed }) => [styles.person, pressed && { opacity: 0.85 }]}
      >
        <PersonAvatar name={person.displayName} photoUrl={person.photoUrl} size={56} />
        <View style={styles.copy}>
          <Text variant="title">{person.displayName}</Text>
          <Text variant="caption" tone="textSecondary">
            {meta}
          </Text>
          <Text variant="caption" tone="chemistryText">
            {alignmentWords(person.overall)}
          </Text>
        </View>
      </Pressable>
      {item.note ? (
        <Text variant="caption" tone="textSecondary" style={styles.note}>
          “{item.note}”
        </Text>
      ) : null}
      {respond.isError ? <ErrorNotice message={errorMessage(respond.error)} /> : null}
      <View style={styles.actions}>
        {section === 'incoming' && requestId ? (
          <>
            <Button
              label="Decline"
              variant="secondary"
              style={styles.grow}
              loading={respond.isPending && respond.variables?.action === 'decline'}
              onPress={() => respond.mutate({ requestId, action: 'decline', userId })}
            />
            <Button
              label="Accept"
              style={styles.grow}
              loading={respond.isPending && respond.variables?.action === 'accept'}
              onPress={() => respond.mutate({ requestId, action: 'accept', userId })}
            />
          </>
        ) : null}
        {section === 'outgoing' && requestId ? (
          <Button
            label="Withdraw"
            variant="quiet"
            loading={respond.isPending}
            onPress={() => respond.mutate({ requestId, action: 'withdraw', userId })}
          />
        ) : null}
        {section === 'mutual' ? (
          <>
            <Text variant="caption" tone="textSecondary" style={styles.grow}>
              Messaging arrives in the next release.
            </Text>
            <Button label="End" variant="quiet" onPress={() => onEnd(item)} />
          </>
        ) : null}
        {section === 'saved' ? (
          <Button
            label="Remove from saved"
            variant="quiet"
            loading={save.isPending}
            onPress={() => save.mutate({ userId, saved: false })}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Requests, mutual connections and saved people. No unread counters, no streaks. */
export default function ConnectionsScreen() {
  const connections = useConnections();
  const end = useEndConnection();
  const [section, setSection] = useState<Section>('incoming');
  const [ending, setEnding] = useState<ConnectionItem | null>(null);
  const items = connections.data?.[section] ?? [];

  return (
    <Screen eyebrow="Connections" title="People you’re getting to know.">
      <ModeSwitch label="Show" value={section} options={SECTIONS} onChange={setSection} />
      <View style={styles.list}>
        {connections.isPending ? <ActivityIndicator color={color.textSecondary} /> : null}
        {connections.isError ? (
          <>
            <ErrorNotice message={errorMessage(connections.error)} />
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => void connections.refetch()}
            />
          </>
        ) : null}
        {connections.data && items.length === 0 ? (
          <Text tone="textSecondary">{EMPTY[section]}</Text>
        ) : null}
        {items.map((item) => (
          <Row
            key={`${section}-${item.person.userId}`}
            item={item}
            section={section}
            onEnd={setEnding}
          />
        ))}
      </View>

      <BottomSheet
        visible={ending !== null}
        title="End this connection?"
        onClose={() => setEnding(null)}
      >
        <Text tone="textSecondary" style={styles.sheetIntro}>
          You’ll both lose the connection with {ending?.person.displayName}. They won’t be told why.
        </Text>
        {end.isError ? <ErrorNotice message={errorMessage(end.error)} /> : null}
        <Button
          label="End connection"
          variant="danger"
          loading={end.isPending}
          onPress={() =>
            ending?.id &&
            end.mutate(
              { matchId: ending.id, userId: ending.person.userId },
              { onSuccess: () => setEnding(null) },
            )
          }
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.xl, gap: space.s },
  row: {
    paddingVertical: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    gap: space.s,
  },
  person: { flexDirection: 'row', gap: space.l, alignItems: 'center' },
  copy: { flex: 1, gap: space.xxs },
  note: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  grow: { flex: 1 },
  sheetIntro: { marginBottom: space.l },
});

import { color, space } from '@vyra/design-system';
import { CONNECTION_NOTE_MAX, REPORT_REASONS, type ReportRequest } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { SelectRow } from '@/components/ui/select-row';
import { TextField } from '@/components/ui/text-field';
import { errorMessage } from '@/lib/api';
import {
  useBlock,
  useConnect,
  useEndConnection,
  usePass,
  useRelationship,
  useReport,
  useRespond,
  useSave,
} from './discovery-api';

const REPORT_LABELS: Readonly<Record<ReportRequest['reason'], string>> = {
  HARASSMENT: 'Harassment or hateful behaviour',
  INAPPROPRIATE_CONTENT: 'Inappropriate photos or text',
  FAKE_PROFILE: 'Fake profile or impersonation',
  UNDERAGE: 'May be under 18',
  SPAM_OR_SCAM: 'Spam, scam or selling',
  OFFLINE_SAFETY: 'Safety concern offline',
  OTHER: 'Something else',
};

const BLOCKED_REASON: Readonly<Record<'declined_recently' | 'too_many_pending', string>> = {
  declined_recently: 'They declined recently. You can ask again later.',
  too_many_pending: 'You have many requests waiting. Withdraw one to send another.',
};

type Sheet = 'connect' | 'more' | 'block' | 'report' | 'end' | null;

/**
 * Everything you can do about someone from their profile. The buttons follow
 * where the two of you stand, so there is only ever one sensible next step.
 */
export function PersonActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const relationship = useRelationship(userId);
  const save = useSave();
  const pass = usePass();
  const connect = useConnect();
  const respond = useRespond();
  const end = useEndConnection();
  const block = useBlock();
  const report = useReport();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<ReportRequest['reason'] | null>(null);
  const [reported, setReported] = useState(false);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/discover'));
  const state = relationship.data;
  const error = [save, pass, connect, respond, end, block].find((m) => m.isError)?.error;

  if (!state) {
    return relationship.isError ? <ErrorNotice message={errorMessage(relationship.error)} /> : null;
  }

  let main;
  if (state.matchId) {
    main = (
      <Text variant="bodyStrong" tone="chemistryText" role="status">
        You’re connected. Messaging arrives in the next release.
      </Text>
    );
  } else if (state.incomingRequestId) {
    const requestId = state.incomingRequestId;
    main = (
      <>
        <Text variant="bodyStrong" tone="chemistryText">
          {name} asked to connect.
        </Text>
        <View style={styles.row}>
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
        </View>
      </>
    );
  } else if (state.outgoingRequestId) {
    const requestId = state.outgoingRequestId;
    main = (
      <View style={styles.row}>
        <Text variant="bodyStrong" style={styles.grow} role="status">
          Request sent
        </Text>
        <Button
          label="Withdraw"
          variant="quiet"
          loading={respond.isPending}
          onPress={() => respond.mutate({ requestId, action: 'withdraw', userId })}
        />
      </View>
    );
  } else {
    main = (
      <>
        {state.requestBlockedReason ? (
          <Text variant="caption" tone="textSecondary">
            {BLOCKED_REASON[state.requestBlockedReason]}
          </Text>
        ) : null}
        <View style={styles.row}>
          <Button
            label="Pass"
            variant="quiet"
            loading={pass.isPending}
            onPress={() => pass.mutate(userId, { onSuccess: leave })}
          />
          <Button
            label={state.saved ? 'Saved' : 'Save'}
            variant="secondary"
            aria-pressed={state.saved}
            loading={save.isPending}
            onPress={() => save.mutate({ userId, saved: !state.saved })}
          />
          <Button
            label="Connect"
            style={styles.grow}
            disabled={state.requestBlockedReason !== null}
            onPress={() => setSheet('connect')}
          />
        </View>
      </>
    );
  }

  return (
    <View style={styles.root}>
      {main}
      {error ? <ErrorNotice message={errorMessage(error)} /> : null}
      <Button label="More options" variant="quiet" onPress={() => setSheet('more')} />

      <BottomSheet
        visible={sheet === 'connect'}
        title={`Connect with ${name}`}
        onClose={() => setSheet(null)}
      >
        <Text tone="textSecondary" style={styles.sheetIntro}>
          A note is optional. If they accept, you can talk once messaging opens.
        </Text>
        <TextField
          label="Add a note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={CONNECTION_NOTE_MAX}
          multiline
          hint={`${note.length} / ${CONNECTION_NOTE_MAX}`}
        />
        {connect.isError ? <ErrorNotice message={errorMessage(connect.error)} /> : null}
        <Button
          label="Send request"
          loading={connect.isPending}
          onPress={() =>
            connect.mutate(
              { recipientId: userId, ...(note.trim() ? { note: note.trim() } : {}) },
              {
                onSuccess: () => {
                  setNote('');
                  setSheet(null);
                },
              },
            )
          }
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'more'} title="More options" onClose={() => setSheet(null)}>
        {state.matchId ? (
          <Button label="End connection" variant="secondary" onPress={() => setSheet('end')} />
        ) : null}
        <View style={styles.stack}>
          <Button label={`Report ${name}`} variant="secondary" onPress={() => setSheet('report')} />
          <Button label={`Block ${name}`} variant="danger" onPress={() => setSheet('block')} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'end'}
        title="End this connection?"
        onClose={() => setSheet(null)}
      >
        <Text tone="textSecondary" style={styles.sheetIntro}>
          You’ll both lose the connection. They won’t be told why.
        </Text>
        <Button
          label="End connection"
          variant="danger"
          loading={end.isPending}
          onPress={() =>
            state.matchId &&
            end.mutate({ matchId: state.matchId, userId }, { onSuccess: () => setSheet(null) })
          }
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'block'}
        title={`Block ${name}?`}
        onClose={() => setSheet(null)}
      >
        <Text tone="textSecondary" style={styles.sheetIntro}>
          You won’t see each other anywhere in VYRA. Any connection or request between you ends.
          They aren’t told. You can unblock from Settings.
        </Text>
        <Button
          label="Block"
          variant="danger"
          loading={block.isPending}
          onPress={() =>
            block.mutate(
              { userId, blocked: true },
              {
                onSuccess: () => {
                  setSheet(null);
                  leave();
                },
              },
            )
          }
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'report'}
        title={reported ? 'Thank you.' : `Report ${name}`}
        onClose={() => setSheet(null)}
      >
        {reported ? (
          <>
            <Text tone="textSecondary" style={styles.sheetIntro}>
              Our team will review this. You can also block {name} so you don’t see each other.
            </Text>
            <Button label="Block" variant="danger" onPress={() => setSheet('block')} />
            <Button label="Done" variant="quiet" onPress={() => setSheet(null)} />
          </>
        ) : (
          <>
            {REPORT_REASONS.map((key) => (
              <SelectRow
                key={key}
                kind="radio"
                label={REPORT_LABELS[key]}
                selected={reason === key}
                onPress={() => setReason(key)}
              />
            ))}
            {report.isError ? <ErrorNotice message={errorMessage(report.error)} /> : null}
            <Button
              label="Send report"
              disabled={reason === null}
              loading={report.isPending}
              style={styles.sheetAction}
              onPress={() =>
                reason &&
                report.mutate(
                  { reportedUserId: userId, reason },
                  { onSuccess: () => setReported(true) },
                )
              }
            />
          </>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.m,
    paddingTop: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  grow: { flex: 1 },
  stack: { gap: space.s, marginTop: space.s },
  sheetIntro: { marginBottom: space.l },
  sheetAction: { marginTop: space.l },
});

import { color, space } from '@vyra/design-system';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { useBlock, useBlocked } from '@/features/discovery/discovery-api';
import { errorMessage } from '@/lib/api';

/** People you've blocked. Names only: nothing else about them is shown here. */
export default function BlockedScreen() {
  const blocked = useBlocked();
  const block = useBlock();
  const list = blocked.data?.blocked ?? [];

  return (
    <FormScreen
      eyebrow="Settings"
      title="Blocked people"
      intro="You and the people here can’t see each other anywhere in VYRA. Unblocking doesn’t restore an earlier connection or request."
    >
      {blocked.isPending ? <ActivityIndicator color={color.textSecondary} /> : null}
      {blocked.isError ? <ErrorNotice message={errorMessage(blocked.error)} /> : null}
      {blocked.data && list.length === 0 ? (
        <Text tone="textSecondary">You haven’t blocked anyone.</Text>
      ) : null}
      {block.isError ? <ErrorNotice message={errorMessage(block.error)} /> : null}
      {list.map((person) => (
        <View key={person.userId} style={styles.row}>
          <View style={styles.copy}>
            <Text variant="bodyStrong">{person.displayName || 'Someone'}</Text>
            <Text variant="caption" tone="textSecondary">
              Blocked {new Date(person.blockedAt).toLocaleDateString()}
            </Text>
          </View>
          <Button
            label="Unblock"
            variant="secondary"
            aria-label={`Unblock ${person.displayName || 'this person'}`}
            loading={block.isPending && block.variables?.userId === person.userId}
            onPress={() => block.mutate({ userId: person.userId, blocked: false })}
          />
        </View>
      ))}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  copy: { flex: 1, gap: space.xxs },
});

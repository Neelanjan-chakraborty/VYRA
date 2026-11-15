import { color } from '@vyra/design-system';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/screen';
import { TabBarItem } from '@/components/tab-bar-item';
import { useConnections } from '@/features/discovery/discovery-api';
import { useConversations } from '@/features/messaging/messaging-api';
import { usePushNotifications } from '@/features/messaging/push';
import { useRealtime } from '@/features/messaging/realtime';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  useRealtime();
  const conversations = useConversations().data?.conversations ?? [];
  const incoming = useConnections().data?.incoming.length ?? 0;
  usePushNotifications(conversations.length > 0);
  return (
    <Tabs style={styles.root}>
      <TabSlot />
      <TabList
        style={[
          styles.bar,
          { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ]}
      >
        <TabTrigger name="orbit" href="/(tabs)" asChild>
          <TabBarItem icon="orbit" label="Orbit" />
        </TabTrigger>
        <TabTrigger name="discover" href="/(tabs)/discover" asChild>
          <TabBarItem icon="discover" label="Discover" />
        </TabTrigger>
        <TabTrigger name="connections" href="/(tabs)/connections" asChild>
          <TabBarItem icon="connections" label="Connections" dot={incoming > 0} />
        </TabTrigger>
        <TabTrigger name="messages" href="/(tabs)/messages" asChild>
          <TabBarItem icon="messages" label="Messages" dot={conversations.some((c) => c.unread)} />
        </TabTrigger>
        <TabTrigger name="you" href="/(tabs)/you" asChild>
          <TabBarItem icon="you" label="You" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: color.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
});

import { color } from '@vyra/design-system';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/components/screen';
import { TabBarItem } from '@/components/tab-bar-item';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={styles.root}>
      <TabSlot />
      <TabList
        style={[
          styles.bar,
          { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ]}
      >
        <TabTrigger name="orbit" href="/" asChild>
          <TabBarItem icon="orbit" label="Orbit" />
        </TabTrigger>
        <TabTrigger name="discover" href="/discover" asChild>
          <TabBarItem icon="discover" label="Discover" />
        </TabTrigger>
        <TabTrigger name="connections" href="/connections" asChild>
          <TabBarItem icon="connections" label="Connections" />
        </TabTrigger>
        <TabTrigger name="messages" href="/messages" asChild>
          <TabBarItem icon="messages" label="Messages" />
        </TabTrigger>
        <TabTrigger name="you" href="/you" asChild>
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

import { color } from '@vyra/design-system';
import { Stack } from 'expo-router/stack';

export default function GroupLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }}
    />
  );
}

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

/**
 * Registers this phone for push notifications. Asked only once someone has a
 * mutual connection, never at sign-up. Needs a development or store build
 * linked to an EAS project; Expo Go and the web build skip it quietly.
 */
async function register(): Promise<void> {
  if (Platform.OS === 'web') return;
  const projectId: unknown =
    Constants.expoConfig?.extra?.['eas']?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string') return;
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/me/push-devices', {
    method: 'PUT',
    body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
  });
}

export function usePushNotifications(enabled: boolean): void {
  const router = useRouter();
  const asked = useRef(false);
  useEffect(() => {
    if (!enabled || asked.current) return;
    asked.current = true;
    void register().catch(() => undefined);
  }, [enabled]);
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    // Opening a notification goes straight to the conversation it is about.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const id: unknown = response.notification.request.content.data?.['conversationId'];
      if (typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)) router.push(`/conversation/${id}`);
      else router.push('/(tabs)/connections');
    });
    return () => subscription.remove();
  }, [router]);
}

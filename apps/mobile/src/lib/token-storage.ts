import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'vyra.refresh-token';

/**
 * Where the refresh token lives between launches. On iOS and Android that is
 * the Keychain / Keystore. The web build is a development and QA target only,
 * so it uses sessionStorage, which the browser clears when the tab closes.
 */
export const tokenStorage = {
  async read(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(KEY) ?? null;
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async write(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(KEY, token);
      else await SecureStore.setItemAsync(KEY, token);
    } catch {
      // Storage unavailable: the session still works until the app is closed.
    }
  },
  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(KEY);
      else await SecureStore.deleteItemAsync(KEY);
    } catch {
      // Nothing to clear.
    }
  },
};

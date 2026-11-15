import { type AssistantId, assistantPromptUrl } from '@vyra/validation';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Android package names of the assistants' own apps. */
const ANDROID_APP: Partial<Record<AssistantId, string>> = {
  chatgpt: 'com.openai.chatgpt',
  gemini: 'com.google.android.apps.bard',
};

/** A failed launch rejects at once; a successful one stays pending until the person is back. */
const LAUNCH_SETTLE_MS = 700;

/** Shares text straight to one installed app. False when it isn't there or can't take it. */
async function sendToApp(packageName: string, text: string): Promise<boolean> {
  try {
    // Loaded here so a build without the native module falls back to the web link
    // instead of failing when this file is first read.
    const launcher = require('expo-intent-launcher') as typeof import('expo-intent-launcher');
    const launched = launcher
      .startActivityAsync('android.intent.action.SEND', {
        type: 'text/plain',
        packageName,
        extra: { 'android.intent.extra.TEXT': text },
      })
      .then(
        () => true,
        () => false,
      );
    const settled = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(true), LAUNCH_SETTLE_MS),
    );
    return await Promise.race([launched, settled]);
  } catch {
    return false;
  }
}

export type OpenedVia = 'app' | 'web';

/**
 * Opens an assistant with the questions. On Android, if its app is installed
 * the questions go straight into a new message there; otherwise (or on other
 * platforms) the assistant's website opens with the questions in the link.
 * Returns which one was used, or null if neither assistant link exists.
 */
export async function openAssistantWithPrompt(
  assistant: AssistantId,
  prompt: string,
): Promise<OpenedVia | null> {
  const packageName = ANDROID_APP[assistant];
  if (Platform.OS === 'android' && packageName && (await sendToApp(packageName, prompt))) {
    return 'app';
  }
  const url = assistantPromptUrl(assistant, prompt);
  if (!url) return null;
  await Linking.openURL(url);
  return 'web';
}

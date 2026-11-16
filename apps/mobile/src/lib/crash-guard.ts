import * as SecureStore from 'expo-secure-store';

/**
 * Remembers that a risky step started and clears it when it finishes. If the
 * app dies in between (a native crash can't be caught in JavaScript), the next
 * launch finds the mark and knows to leave that step alone instead of crashing
 * again in a loop. The mark expires, so a one-off kill doesn't disable it forever.
 */
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const key = (name: string) => `vyra.guard.${name}`;

/** True if the last attempt never finished and it was recent. */
export async function crashedLastTime(name: string): Promise<boolean> {
  try {
    const started = Number(await SecureStore.getItemAsync(key(name)));
    return Number.isFinite(started) && started > 0 && Date.now() - started < RETRY_AFTER_MS;
  } catch {
    return false;
  }
}

export async function markStarted(name: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key(name), String(Date.now()));
  } catch {
    // Storage unavailable: carry on without the guard.
  }
}

export async function markFinished(name: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key(name));
  } catch {
    // Nothing to clear.
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void store.set(key, value),
  deleteItemAsync: async (key: string) => void store.delete(key),
}));

const { crashedLastTime, markFinished, markStarted } = await import('./crash-guard');

describe('crash guard', () => {
  beforeEach(() => {
    store.clear();
    vi.useRealTimers();
  });

  it('is clear on a fresh install and after a step finishes', async () => {
    expect(await crashedLastTime('push')).toBe(false);
    await markStarted('push');
    await markFinished('push');
    expect(await crashedLastTime('push')).toBe(false);
  });

  it('trips when a step started and never finished, until the day is up', async () => {
    await markStarted('push');
    expect(await crashedLastTime('push')).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    expect(await crashedLastTime('push')).toBe(false);
  });

  it('keeps separate steps apart', async () => {
    await markStarted('push');
    expect(await crashedLastTime('other')).toBe(false);
  });
});

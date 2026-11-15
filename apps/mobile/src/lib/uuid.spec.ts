import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUuid } from './uuid';

describe('randomUuid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes valid, distinct v4 ids without any crypto (as on a phone)', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = Array.from({ length: 500 }, randomUuid);
    for (const id of ids) expect(z.uuid().safeParse(id).success).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('works with only getRandomValues', () => {
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint8Array) => array.fill(7) });
    expect(z.uuid().safeParse(randomUuid()).success).toBe(true);
  });

  it('uses randomUUID when the engine has it', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' });
    expect(randomUuid()).toBe('123e4567-e89b-42d3-a456-426614174000');
  });
});

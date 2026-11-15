import { describe, expect, it } from 'vitest';
import {
  normalizeUsername,
  searchQuerySchema,
  usernameProblem,
  usernameSchema,
} from './username.js';

describe('username', () => {
  it('normalises case, spaces and a leading @', () => {
    expect(normalizeUsername('  @Asha.Rao ')).toBe('asha.rao');
    expect(usernameSchema.parse('@Neel_01')).toBe('neel_01');
  });

  it.each(['asha', 'asha.rao', 'a_b', 'asha99', 'x1y', 'a.b.c'])('accepts %s', (name) => {
    expect(usernameProblem(name)).toBeNull();
  });

  it.each([
    ['ab', 'at least'],
    ['a'.repeat(31), 'at most'],
    ['has space', 'only letters'],
    ['émile', 'only letters'],
    ['.asha', 'Start and end'],
    ['asha_', 'Start and end'],
    ['a..b', 'next to each other'],
    ['a._b', 'next to each other'],
    ['12345', 'at least one letter'],
    ['admin', 'isn’t available'],
    ['v.y.r.a', 'isn’t available'],
    ['Support', 'only letters'],
  ])('rejects %s', (name, fragment) => {
    // "Support" is checked un-normalised here on purpose: the schema normalises first.
    expect(usernameProblem(name)).toContain(fragment);
  });

  it('the schema normalises before judging', () => {
    expect(usernameSchema.safeParse('Support').success).toBe(false);
    expect(usernameSchema.safeParse('ASHA').success).toBe(true);
  });
});

describe('search query', () => {
  it('trims, bounds and defaults', () => {
    expect(searchQuerySchema.parse({ q: '  as ' })).toEqual({ q: 'as', limit: 12 });
    expect(searchQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: 'x'.repeat(41) }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: 'ok', limit: 99 }).success).toBe(false);
  });
});

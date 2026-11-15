import { z } from 'zod';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
/** Days a person must wait between username changes. */
export const USERNAME_CHANGE_DAYS = 14;

/**
 * Names that could pass for the service, its staff or a route. Compared after
 * normalisation, so "Admin" and "@admin" are caught too.
 */
const RESERVED = new Set([
  'about',
  'account',
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'blocked',
  'contact',
  'discover',
  'docs',
  'help',
  'legal',
  'login',
  'logout',
  'me',
  'messages',
  'moderation',
  'moderator',
  'null',
  'official',
  'people',
  'privacy',
  'root',
  'safety',
  'search',
  'security',
  'settings',
  'signin',
  'signup',
  'staff',
  'support',
  'system',
  'team',
  'terms',
  'undefined',
  'vyra',
  'vyrasupport',
  'vyrateam',
  'wingman',
  'www',
]);

/** Lower-case, no leading "@", no surrounding spaces. What is stored and compared. */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Why a normalised username can't be used, in words a person can act on, or
 * null when it is acceptable. Availability (already taken) is checked by the API.
 */
export function usernameProblem(username: string): string | null {
  if (username.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters`;
  if (username.length > USERNAME_MAX) return `Use at most ${USERNAME_MAX} characters`;
  if (!/^[a-z0-9._]+$/.test(username)) return 'Use only letters, numbers, dots and underscores';
  if (!/^[a-z0-9]/.test(username) || !/[a-z0-9]$/.test(username))
    return 'Start and end with a letter or number';
  if (/[._]{2}/.test(username)) return 'Don’t put dots or underscores next to each other';
  if (/^[0-9]+$/.test(username)) return 'Include at least one letter';
  if (RESERVED.has(username.replace(/[._]/g, ''))) return 'That name isn’t available';
  return null;
}

export const usernameSchema = z
  .string()
  .max(USERNAME_MAX + 8)
  .transform(normalizeUsername)
  .superRefine((value, ctx) => {
    const problem = usernameProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

export const usernameUpdateSchema = z.object({ username: usernameSchema });
export type UsernameUpdate = z.input<typeof usernameUpdateSchema>;

export const usernameCheckSchema = z.object({
  /** The normalised form that was checked. */
  username: z.string(),
  available: z.boolean(),
  /** Why not, when it isn't available. */
  reason: z.string().nullable(),
});
export type UsernameCheck = z.infer<typeof usernameCheckSchema>;

// ───────────────────────────────── search ─────────────────────────────────

export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 40;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(SEARCH_QUERY_MIN).max(SEARCH_QUERY_MAX),
  limit: z.coerce.number().int().min(1).max(20).default(12),
});

export const searchRelationSchema = z.enum(['none', 'connected', 'pending']);

export const searchResultSchema = z.object({
  userId: z.uuid(),
  username: z.string().nullable(),
  displayName: z.string(),
  age: z.number().int(),
  city: z.string().nullable(),
  /** A signed thumbnail of the first approved photo; null when there isn't one to show. */
  photoUrl: z.string().nullable(),
  /** What you and this person already have: nothing, a connection, or a request in flight. */
  relation: searchRelationSchema,
  matchedOn: z.enum(['username', 'name']),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResultsSchema = z.object({ results: z.array(searchResultSchema) });
export type SearchResults = z.infer<typeof searchResultsSchema>;

export const resolvedPersonSchema = z.object({ userId: z.uuid() });
export type ResolvedPerson = z.infer<typeof resolvedPersonSchema>;

import { USERNAME_CHANGE_DAYS } from '@vyra/validation';

const DAY_MS = 86_400_000;

/** When a username can next change, or null if it can now (or was never set). */
export function usernameChangeableAt(
  changedAt: Date | null,
  hasUsername: boolean,
  now = new Date(),
): Date | null {
  if (!hasUsername || !changedAt) return null;
  const next = new Date(changedAt.getTime() + USERNAME_CHANGE_DAYS * DAY_MS);
  return next > now ? next : null;
}

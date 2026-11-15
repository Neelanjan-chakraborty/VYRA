import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { hmacHex, safeEqualHex } from '../auth/crypto.js';

export const MEDIA_URL_TTL_SECONDS = 10 * 60;

/**
 * Who a media URL was issued to. The scope is part of the signature, so a URL
 * cannot be re-scoped, and the media endpoint applies different rules to each:
 * - `public`: anyone else — served only while the photo is APPROVED and its
 *   owner is active and discoverable.
 * - `owner`: the photo's owner, via their own endpoints — any status.
 * - `moderator`: someone reviewing it — any status.
 * - `conversation`: the other participant of a conversation — message media
 *   only, while APPROVED, not removed or reported, and nobody has blocked.
 */
export type MediaScope = 'public' | 'owner' | 'moderator' | 'conversation';
const SCOPE_CODES: Readonly<Record<MediaScope, string>> = {
  public: 'p',
  owner: 'o',
  moderator: 'm',
  conversation: 'c',
};
const SCOPES_BY_CODE = new Map(
  Object.entries(SCOPE_CODES).map(([scope, code]) => [code, scope as MediaScope]),
);

/** Signs and checks short-lived URLs so media is never publicly addressable. */
@Injectable()
export class MediaUrlService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private signature(key: string, scope: string, expires: number): string {
    return hmacHex(this.env.MEDIA_URL_SECRET, `${key}:${scope}:${expires}`);
  }

  sign(key: string, scope: MediaScope, now: number = Date.now()): string {
    const expires = Math.floor(now / 1000) + MEDIA_URL_TTL_SECONDS;
    const code = SCOPE_CODES[scope];
    return `${this.env.PUBLIC_API_URL}/v1/media/${key}?s=${code}&exp=${expires}&sig=${this.signature(key, code, expires)}`;
  }

  /** The scope a valid URL was issued for, or null if the URL is invalid or expired. */
  verify(
    key: string,
    scopeCode: string | undefined,
    expires: string | undefined,
    signature: string | undefined,
  ): MediaScope | null {
    const scope = scopeCode ? SCOPES_BY_CODE.get(scopeCode) : undefined;
    if (!scope) return null;
    const exp = Number(expires);
    if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return null;
    if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return null;
    return safeEqualHex(signature, this.signature(key, scopeCode as string, exp)) ? scope : null;
  }
}

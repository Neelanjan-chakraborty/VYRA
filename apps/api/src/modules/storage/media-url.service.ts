import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { hmacHex, safeEqualHex } from '../auth/crypto.js';

export const MEDIA_URL_TTL_SECONDS = 10 * 60;

/** Signs and checks short-lived URLs so media is never publicly addressable. */
@Injectable()
export class MediaUrlService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private signature(key: string, expires: number): string {
    return hmacHex(this.env.MEDIA_URL_SECRET, `${key}:${expires}`);
  }

  sign(key: string, now: number = Date.now()): string {
    const expires = Math.floor(now / 1000) + MEDIA_URL_TTL_SECONDS;
    return `${this.env.PUBLIC_API_URL}/v1/media/${key}?exp=${expires}&sig=${this.signature(key, expires)}`;
  }

  isValid(key: string, expires: string | undefined, signature: string | undefined): boolean {
    const exp = Number(expires);
    if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return false;
    if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
    return safeEqualHex(signature, this.signature(key, exp));
  }
}

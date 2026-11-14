import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export function hmacHex(key: string, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** 256 bits of randomness, URL-safe. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function randomOtp(length: number): string {
  return Array.from({ length }, () => randomInt(10)).join('');
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

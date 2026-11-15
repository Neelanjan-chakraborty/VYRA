import type { Env } from '../../config/env.js';
import { MediaUrlService } from './media-url.service.js';

const urls = new MediaUrlService({
  MEDIA_URL_SECRET: 'x'.repeat(48),
  PUBLIC_API_URL: 'http://localhost:4000',
} as Env);
const at = Date.UTC(2026, 10, 15, 12, 0, 30);
const exp = (url: string) => Number(new URL(url).searchParams.get('exp'));

describe('MediaUrlService', () => {
  it('gives the same URL when the same file is signed again shortly after', () => {
    const first = urls.sign('photos/a/b.avif', 'owner', at);
    expect(urls.sign('photos/a/b.avif', 'owner', at + 90_000)).toBe(first);
    const life = exp(first) * 1000 - at;
    expect(life).toBeGreaterThanOrEqual(10 * 60_000);
    expect(life).toBeLessThanOrEqual(15 * 60_000);
  });

  it('keeps short-lived URLs exact, and checks scope and signature', () => {
    const opened = urls.sign('messages/c/d.avif', 'opened', at, 60);
    expect(exp(opened) * 1000 - at).toBeLessThanOrEqual(60_000);
    const url = new URL(urls.sign('messages/c/d.avif', 'conversation'));
    const [s, e, sig] = ['s', 'exp', 'sig'].map((k) => url.searchParams.get(k) ?? undefined);
    expect(urls.verify('messages/c/d.avif', s, e, sig)).toBe('conversation');
    expect(urls.verify('messages/c/d.avif', 'o', e, sig)).toBeNull();
    expect(urls.verify('messages/c/other.avif', s, e, sig)).toBeNull();
  });
});

import { site } from '@/lib/site';

export const dynamic = 'force-static';

/**
 * The IndexNow ownership key (INDEXNOW_KEY), served as plain text. Used as the
 * `keyLocation` when scripts/indexnow.mjs tells Bing and other IndexNow
 * engines that pages have changed. 404 until a key is configured.
 */
export function GET() {
  if (!site.indexNowKey) return new Response('Not found', { status: 404 });
  return new Response(site.indexNowKey, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

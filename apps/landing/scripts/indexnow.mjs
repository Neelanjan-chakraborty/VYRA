#!/usr/bin/env node
/**
 * Tells IndexNow (Bing, and the other engines that share the protocol) that the
 * site's pages have changed. Run after a production deploy that changes content.
 *
 *   SITE_URL=https://<domain> INDEXNOW_KEY=<key> pnpm --filter @vyra/landing indexnow
 *
 * The key must be the same INDEXNOW_KEY the site was built with; it is served at
 * /indexnow-key.txt, which is how the engines confirm ownership. URLs are read
 * from the live sitemap, so only canonical, indexable pages are submitted.
 * IndexNow is a notification. It does not guarantee crawling or indexing, and
 * Google does not use it.
 */
const origin = (process.env.SITE_URL ?? '').replace(/\/$/, '');
const key = process.env.INDEXNOW_KEY ?? '';
if (!origin.startsWith('https://') || !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  console.error('Set SITE_URL (https origin) and INDEXNOW_KEY.');
  process.exit(2);
}

const served = await fetch(`${origin}/indexnow-key.txt`).then((r) => (r.ok ? r.text() : ''));
if (served.trim() !== key) {
  console.error(
    `${origin}/indexnow-key.txt does not serve this key. Deploy with INDEXNOW_KEY set first.`,
  );
  process.exit(1);
}

const sitemap = await fetch(`${origin}/sitemap.xml`).then((r) => r.text());
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urlList.length === 0) {
  console.error('The sitemap is empty. Is this deployment indexable?');
  process.exit(1);
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: new URL(origin).host,
    key,
    keyLocation: `${origin}/indexnow-key.txt`,
    urlList,
  }),
});
console.log(`Submitted ${urlList.length} URLs. IndexNow answered ${response.status}.`);
process.exit(response.ok ? 0 : 1);

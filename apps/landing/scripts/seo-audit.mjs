#!/usr/bin/env node
/**
 * Technical SEO audit of the built site, over plain HTTP with no browser, so
 * what it sees is what a crawler receives before any JavaScript runs.
 *
 *   VYRA_SITE_ENV=production NEXT_PUBLIC_SITE_URL=https://<domain> pnpm --filter @vyra/landing build
 *   VYRA_SITE_ENV=production NEXT_PUBLIC_SITE_URL=https://<domain> pnpm --filter @vyra/landing start &
 *   SITE_URL=https://<domain> pnpm --filter @vyra/landing seo:audit [base-url] [--report <file.md>]
 *
 * SITE_URL is the canonical origin the build was given; base-url is where the
 * server is listening (default http://localhost:3100). Set EXPECT=preview to
 * audit a non-production build instead: then everything must be noindex.
 * Exits non-zero if any check fails.
 */
import { writeFileSync } from 'node:fs';
import { parse } from 'node-html-parser';

const args = process.argv.slice(2);
const reportAt = args.indexOf('--report');
const reportPath = reportAt === -1 ? null : args[reportAt + 1];
const base = (
  args.find((a, i) => !a.startsWith('--') && i !== reportAt + 1) ?? 'http://localhost:3100'
).replace(/\/$/, '');
const origin = (process.env.SITE_URL ?? '').replace(/\/$/, '');
const expectPreview = process.env.EXPECT === 'preview';
if (!origin && !expectPreview) {
  console.error('Set SITE_URL to the canonical origin the site was built with.');
  process.exit(2);
}

/** Every page the site serves, and whether it should be indexable in production. */
const PAGES = [
  { path: '/', index: true },
  { path: '/features', index: true },
  { path: '/how-it-works', index: true },
  { path: '/ai-persona', index: true },
  { path: '/compatibility', index: true },
  { path: '/safety', index: true },
  { path: '/about', index: true },
  // Indexable only once NEXT_PUBLIC_CONTACT_EMAIL / VYRA_LEGAL_STATUS=published are set.
  { path: '/contact', index: process.env.EXPECT_CONTACT_INDEXED === 'true' },
  { path: '/privacy', index: process.env.EXPECT_LEGAL_INDEXED === 'true' },
  { path: '/terms', index: process.env.EXPECT_LEGAL_INDEXED === 'true' },
];
const REDIRECTS = [
  ['/about/', '/about'],
  ['/features/', '/features'],
  ['/features/ai-persona', '/ai-persona'],
  ['/features/compatibility', '/compatibility'],
  ['/features/discovery', '/features#discovery'],
  ['/home', '/'],
  ['/privacy-policy', '/privacy'],
];
const MISSING = ['/no-such-page', '/features/no-such-feature', '/app', '/admin'];

const results = [];
const check = (group, name, ok, detail = '') => {
  results.push({ group, name, ok: Boolean(ok), detail });
};
const get = (path, init) => fetch(base + path, { redirect: 'manual', ...init });
const canonicalFor = (path) => (path === '/' ? origin : origin + path);
const meta = (root, selector) => root.querySelector(selector)?.getAttribute('content') ?? null;

const titles = new Map();
const descriptions = new Map();
const internalLinks = new Map();
const assets = new Set();

for (const page of PAGES) {
  const group = page.path;
  const response = await get(page.path);
  check(group, 'returns 200', response.status === 200, `status ${response.status}`);
  if (response.status !== 200) continue;
  const html = await response.text();
  const root = parse(html);
  const shouldIndex = page.index && !expectPreview;

  check(group, 'html lang is en-IN', root.querySelector('html')?.getAttribute('lang') === 'en-IN');

  const title = root.querySelector('title')?.text.trim() ?? '';
  check(
    group,
    'has a title of 15–65 characters',
    title.length >= 15 && title.length <= 65,
    `${title.length}: ${title}`,
  );
  titles.set(page.path, title);

  const description = meta(root, 'meta[name="description"]') ?? '';
  check(
    group,
    'has a meta description of 70–165 characters',
    description.length >= 70 && description.length <= 165,
    `${description.length} characters`,
  );
  descriptions.set(page.path, description);

  const robots = (meta(root, 'meta[name="robots"]') ?? '').toLowerCase();
  const headerRobots = (response.headers.get('x-robots-tag') ?? '').toLowerCase();
  const noindex = robots.includes('noindex') || headerRobots.includes('noindex');
  check(
    group,
    shouldIndex ? 'is indexable (no noindex)' : 'is marked noindex',
    shouldIndex ? !noindex : noindex,
    `meta robots "${robots}"${headerRobots ? `, header "${headerRobots}"` : ''}`,
  );

  if (!expectPreview) {
    const canonicals = root
      .querySelectorAll('link[rel="canonical"]')
      .map((l) => l.getAttribute('href'));
    check(
      group,
      'has exactly one canonical, absolute and on the production origin',
      canonicals.length === 1 && canonicals[0] === canonicalFor(page.path),
      canonicals.join(', '),
    );

    const alternates = root.querySelectorAll('link[rel="alternate"][hreflang]');
    const hreflang = Object.fromEntries(
      alternates.map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]),
    );
    check(
      group,
      'hreflang en-IN and x-default point at the canonical',
      hreflang['en-IN'] === canonicalFor(page.path) &&
        hreflang['x-default'] === canonicalFor(page.path),
      JSON.stringify(hreflang),
    );

    check(
      group,
      'og:url equals the canonical',
      meta(root, 'meta[property="og:url"]') === canonicalFor(page.path),
    );
    const ogImage = meta(root, 'meta[property="og:image"]') ?? '';
    check(
      group,
      'og:image is absolute and on the production origin',
      ogImage.startsWith(`${origin}/`),
      ogImage,
    );
    if (ogImage.startsWith(`${origin}/`)) assets.add(ogImage.slice(origin.length));
    check(
      group,
      'no localhost or staging origin anywhere in the head',
      !/localhost|127\.0\.0\.1|vercel\.app|netlify\.app/.test(
        root.querySelector('head')?.innerHTML ?? '',
      ),
    );
  }
  for (const property of [
    'og:title',
    'og:description',
    'og:type',
    'og:site_name',
    'og:locale',
    'og:image:alt',
  ]) {
    check(group, `has ${property}`, Boolean(meta(root, `meta[property="${property}"]`)));
  }
  check(group, 'og:locale is en_IN', meta(root, 'meta[property="og:locale"]') === 'en_IN');
  check(
    group,
    'twitter card is summary_large_image',
    meta(root, 'meta[name="twitter:card"]') === 'summary_large_image',
  );
  check(
    group,
    'has twitter:title and twitter:image',
    Boolean(meta(root, 'meta[name="twitter:title"]')) &&
      Boolean(meta(root, 'meta[name="twitter:image"]')),
  );
  check(
    group,
    'has favicon and Apple touch icon',
    Boolean(root.querySelector('link[rel="icon"]')) &&
      Boolean(root.querySelector('link[rel="apple-touch-icon"]')),
  );
  check(
    group,
    'has a viewport meta tag',
    (meta(root, 'meta[name="viewport"]') ?? '').includes('width=device-width'),
  );

  // Headings and landmarks.
  const h1 = root.querySelectorAll('h1');
  check(group, 'has exactly one h1', h1.length === 1, `${h1.length} found`);
  const levels = root.querySelectorAll('h1,h2,h3,h4,h5,h6').map((h) => Number(h.tagName[1]));
  const skips = levels.filter((level, i) => i > 0 && level > levels[i - 1] + 1).length;
  check(
    group,
    'heading levels never skip downwards',
    levels[0] === 1 || levels.indexOf(1) <= 1 ? skips === 0 : false,
    `order ${levels.join('')}`,
  );
  for (const landmark of ['header', 'main', 'footer', 'nav']) {
    check(group, `has a <${landmark}> element`, Boolean(root.querySelector(landmark)));
  }
  check(group, 'has one <main>', root.querySelectorAll('main').length === 1);

  // Primary content must be in the HTML itself.
  const main = root.querySelector('main');
  const words = (main?.text ?? '').split(/\s+/).filter(Boolean).length;
  check(
    group,
    'main content is server-rendered (150+ words in the HTML)',
    words >= 150,
    `${words} words`,
  );
  check(group, 'h1 text is in the HTML', (h1[0]?.text.trim().length ?? 0) > 5, h1[0]?.text.trim());

  // Images.
  const images = root.querySelectorAll('img');
  const noAlt = images.filter((img) => img.getAttribute('alt') === undefined);
  check(group, 'every image has an alt attribute', noAlt.length === 0, `${images.length} images`);
  const thin = images.filter((img) => {
    const alt = img.getAttribute('alt') ?? '';
    return alt !== '' && alt.length < 20;
  });
  check(
    group,
    'content images have descriptive alt text',
    thin.length === 0,
    thin.map((img) => img.getAttribute('alt')).join(' | '),
  );
  check(
    group,
    'every image declares width and height',
    images.every((img) => img.getAttribute('width') && img.getAttribute('height')),
  );
  for (const img of images) {
    const src = img.getAttribute('src');
    if (src?.startsWith('/')) assets.add(src.replaceAll('&amp;', '&'));
  }

  // Links.
  const anchors = root.querySelectorAll('a[href]');
  const vague = anchors.filter((a) =>
    /^(click here|here|read more|learn more|more)$/i.test(a.text.trim()),
  );
  check(
    group,
    'no vague link text',
    vague.length === 0,
    vague.map((a) => a.text.trim()).join(', '),
  );
  const unnamed = anchors.filter((a) => !a.text.trim() && !a.getAttribute('aria-label'));
  check(group, 'every link has an accessible name', unnamed.length === 0);
  const unnamedButtons = root
    .querySelectorAll('button')
    .filter((b) => !b.text.trim() && !b.getAttribute('aria-label'));
  check(group, 'every button has an accessible name', unnamedButtons.length === 0);
  for (const a of anchors) {
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const [path, fragment] = href.split('#');
    if (!internalLinks.has(path || page.path)) internalLinks.set(path || page.path, new Set());
    if (fragment) internalLinks.get(path || page.path).add(fragment);
  }
  for (const link of root.querySelectorAll('link[rel="stylesheet"], script[src]')) {
    const src = link.getAttribute('href') ?? link.getAttribute('src');
    if (src?.startsWith('/')) assets.add(src);
  }

  // Structured data.
  const blocks = root.querySelectorAll('script[type="application/ld+json"]');
  const parsed = [];
  let valid = true;
  for (const block of blocks) {
    try {
      parsed.push(JSON.parse(block.text));
    } catch {
      valid = false;
    }
  }
  check(group, 'JSON-LD parses', valid && parsed.length > 0, `${parsed.length} blocks`);
  const types = parsed.map((item) => item['@type']);
  check(
    group,
    'JSON-LD uses schema.org context',
    parsed.every((item) => item['@context'] === 'https://schema.org'),
  );
  check(
    group,
    'has Organization and WebSite',
    types.includes('Organization') && types.includes('WebSite'),
  );
  check(
    group,
    'has a WebPage entry',
    types.some((type) => ['WebPage', 'AboutPage', 'ContactPage'].includes(type)),
  );
  if (page.path !== '/') {
    const crumbs = parsed.find((item) => item['@type'] === 'BreadcrumbList');
    const items = crumbs?.itemListElement ?? [];
    check(
      group,
      'BreadcrumbList matches the visible breadcrumb',
      items.length === 2 &&
        items.every((item, i) => item.position === i + 1 && item.name) &&
        Boolean(root.querySelector('nav[aria-label="Breadcrumb"]')),
    );
    if (!expectPreview)
      check(
        group,
        'breadcrumb ends at the canonical URL',
        items[1]?.item === canonicalFor(page.path),
      );
  }
  const text = JSON.stringify(parsed);
  check(
    group,
    'no invented ratings, reviews, prices or counts in JSON-LD',
    !/aggregateRating|"review"|"offers"|"price"|ratingValue|interactionCount/i.test(text),
  );
  check(
    group,
    'JSON-LD cannot break out of its script element',
    blocks.every((block) => !/<\/script|<!--/i.test(block.text)),
  );
  if (!expectPreview)
    check(group, 'JSON-LD URLs are on the production origin', !/localhost|127\.0\.0\.1/.test(text));
  const organization = parsed.find((item) => item['@type'] === 'Organization');
  check(
    group,
    'the page visibly names what the Organization markup names',
    html.includes(organization?.name ?? '\u0000') && html.includes('decoded.'),
  );
}

// Uniqueness across pages.
const duplicates = (map) => [...map.values()].filter((value, i, all) => all.indexOf(value) !== i);
check(
  'site',
  'every page title is unique',
  duplicates(titles).length === 0,
  duplicates(titles).join(' | '),
);
check('site', 'every meta description is unique', duplicates(descriptions).length === 0);

// Internal links resolve, including fragments.
for (const [path, fragments] of internalLinks) {
  const response = await get(path);
  const ok = response.status === 200;
  check('links', `${path} resolves`, ok, `status ${response.status}`);
  if (!ok || fragments.size === 0) continue;
  const root = parse(await response.text());
  for (const fragment of fragments) {
    check(
      'links',
      `${path}#${fragment} has a target`,
      Boolean(root.querySelector(`[id="${fragment}"]`)),
    );
  }
}

// Assets a crawler needs are served and not blocked.
let assetFailures = 0;
for (const asset of assets) {
  const response = await get(asset);
  if (response.status !== 200) assetFailures += 1;
}
check(
  'assets',
  `all ${assets.size} referenced images, styles, scripts and social images load`,
  assetFailures === 0,
  `${assetFailures} failed`,
);
const og = await get('/og.png');
check('assets', 'social image is a PNG', og.headers.get('content-type')?.includes('image/png'));
for (const icon of [
  '/favicon.ico',
  '/icon.svg',
  '/apple-icon.png',
  '/logo.png',
  '/manifest.webmanifest',
]) {
  check('assets', `${icon} is served`, (await get(icon)).status === 200);
}

// Redirects and 404s.
for (const [from, to] of REDIRECTS) {
  const response = await get(from);
  const location = response.headers.get('location') ?? '';
  const target = location.startsWith('http')
    ? new URL(location).pathname + new URL(location).hash
    : location;
  check(
    'redirects',
    `${from} permanently redirects to ${to}`,
    response.status === 308 && target === to,
    `${response.status} → ${location}`,
  );
}
for (const path of MISSING) {
  const response = await get(path);
  const body = await response.text();
  check('status', `${path} returns 404`, response.status === 404, `status ${response.status}`);
  check(
    'status',
    `${path} 404 page is noindex and has one h1`,
    /noindex/.test(body) && parse(body).querySelectorAll('h1').length === 1,
  );
}

// robots.txt
const robotsText = await (await get('/robots.txt')).text();
if (expectPreview) {
  check('robots.txt', 'disallows everything on a preview', /Disallow: \/\s*$/m.test(robotsText));
  check('robots.txt', 'advertises no sitemap on a preview', !/Sitemap:/i.test(robotsText));
} else {
  check(
    'robots.txt',
    'allows the site',
    /User-Agent: \*/i.test(robotsText) && /Allow: \/\s*$/m.test(robotsText),
  );
  check('robots.txt', 'does not disallow the whole site', !/Disallow: \/\s*$/m.test(robotsText));
  check(
    'robots.txt',
    'does not block CSS, JavaScript or images',
    !/Disallow:.*(_next|\.css|\.js|\/images|\/screens)/i.test(robotsText),
  );
  check(
    'robots.txt',
    'references the production sitemap',
    robotsText.includes(`Sitemap: ${origin}/sitemap.xml`),
  );
}

// sitemap.xml
const sitemapResponse = await get('/sitemap.xml');
const sitemapXml = await sitemapResponse.text();
const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(
  'sitemap.xml',
  'is served as XML',
  sitemapResponse.status === 200 &&
    (sitemapResponse.headers.get('content-type') ?? '').includes('xml'),
);
if (expectPreview) {
  check('sitemap.xml', 'is empty on a preview', locs.length === 0);
} else {
  const expected = PAGES.filter((page) => page.index).map((page) => canonicalFor(page.path));
  check(
    'sitemap.xml',
    'lists exactly the indexable pages',
    locs.length === expected.length && expected.every((url) => locs.includes(url)),
    locs.map((l) => l.replace(origin, '') || '/').join(' '),
  );
  check('sitemap.xml', 'has no duplicates', new Set(locs).size === locs.length);
  check(
    'sitemap.xml',
    'uses only absolute production URLs',
    locs.every((loc) => loc === origin || loc.startsWith(`${origin}/`)),
  );
  check(
    'sitemap.xml',
    'has no trailing-slash or query variants',
    locs.every((loc) => !loc.endsWith('/') && !loc.includes('?')),
  );
  const dates = [...sitemapXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  check(
    'sitemap.xml',
    'every entry has a valid lastmod that is not in the future',
    dates.length === locs.length &&
      dates.every((d) => !Number.isNaN(Date.parse(d)) && Date.parse(d) <= Date.now() + 864e5),
    dates[0],
  );
  check(
    'sitemap.xml',
    'excludes noindex pages',
    PAGES.filter((p) => !p.index).every((p) => !locs.includes(canonicalFor(p.path))),
  );
}

// Security and crawl headers on the home page.
const home = await get('/');
check(
  'headers',
  'sends X-Content-Type-Options: nosniff',
  home.headers.get('x-content-type-options') === 'nosniff',
);
check('headers', 'does not advertise the framework', !home.headers.get('x-powered-by'));

// Output.
const failed = results.filter((result) => !result.ok);
const groups = [...new Set(results.map((result) => result.group))];
for (const group of groups) {
  const inGroup = results.filter((result) => result.group === group);
  const bad = inGroup.filter((result) => !result.ok);
  console.log(
    `${bad.length === 0 ? 'PASS' : 'FAIL'}  ${group}  (${inGroup.length - bad.length}/${inGroup.length})`,
  );
  for (const result of bad)
    console.log(`        ✗ ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);

if (reportPath) {
  const lines = [
    `| Area | Checks | Passed | Result |`,
    `| ---- | ------ | ------ | ------ |`,
    ...groups.map((group) => {
      const inGroup = results.filter((result) => result.group === group);
      const good = inGroup.filter((result) => result.ok).length;
      return `| \`${group}\` | ${inGroup.length} | ${good} | ${good === inGroup.length ? 'Pass' : 'FAIL'} |`;
    }),
    `| **Total** | **${results.length}** | **${results.length - failed.length}** | **${failed.length === 0 ? 'Pass' : 'FAIL'}** |`,
    '',
    '| Page | Title | Length | Description length |',
    '| ---- | ----- | ------ | ------------------ |',
    ...PAGES.map(
      (page) =>
        `| \`${page.path}\` | ${titles.get(page.path) ?? ''} | ${(titles.get(page.path) ?? '').length} | ${(descriptions.get(page.path) ?? '').length} |`,
    ),
    '',
  ];
  writeFileSync(reportPath, lines.join('\n'));
}
process.exit(failed.length === 0 ? 0 : 1);

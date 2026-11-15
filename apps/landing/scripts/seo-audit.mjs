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
const positional = args.filter(
  (arg, i) => !arg.startsWith('--') && (reportAt === -1 || i !== reportAt + 1),
);
const base = (positional[0] ?? 'http://localhost:3100').replace(/\/$/, '');
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
  { path: '/learn', index: true },
  ...[
    'relationship-compatibility',
    'personality-and-relationships',
    'communication-styles',
    'ai-in-relationship-discovery',
    'dating-beyond-swiping',
    'online-dating-safety',
  ].map((slug) => ({ path: `/learn/${slug}`, index: true, article: true })),
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
// Unknown pages, and every address a private application might live at: none may exist here.
const MISSING = [
  '/no-such-page',
  '/features/no-such-feature',
  '/learn/no-such-article',
  '/app',
  '/admin',
  '/dashboard',
  '/login',
  '/account',
  '/api/users',
];

/** Claims the site must never make: superlatives, guarantees, and numbers it does not have. */
const FORBIDDEN_CLAIMS = [
  /\b(world|india)[’']s (first|best|leading|largest|no\.? ?1)\b/i,
  /\bthe best (dating|relationship|matchmaking)\b/i,
  /\bmost accurate\b/i,
  /#1\b/,
  /(?<!\b(?:not|no|never|cannot|without|or indexing) )\bguarantee[sd]?\b/i,
  /\b(scientifically|clinically) proven\b/i,
  /\bfind your (soulmate|perfect match)\b/i,
  /\b\d[\d,.]*\s*(million|lakh|crore|k\+?)?\s+(users|members|downloads|sign-?ups|matches made)\b/i,
  /\b(download (it )?(now|today)|available (now )?on the (app|play) store|get it on google play)\b/i,
  /\b(trusted by|as seen in|award[- ]winning|rated \d)/i,
];
/** Descriptions of VYRA that contradict its one category. */
const WRONG_CATEGORY =
  /VYRA is (an? )?(AI chatbot|chatbot|social network|matchmaking engine|AI companion|AI girlfriend|AI boyfriend)/i;
const ENTITY_DESCRIPTION =
  'VYRA is an AI-assisted relationship discovery platform designed to help people understand personality, communication, interests and relationship compatibility.';

const results = [];
const check = (group, name, ok, detail = '') => {
  results.push({ group, name, ok: Boolean(ok), detail });
};
const get = (path, init) => fetch(base + path, { redirect: 'manual', ...init });
const canonicalFor = (path) => (path === '/' ? origin : origin + path);
const meta = (root, selector) => root.querySelector(selector)?.getAttribute('content') ?? null;

/** True when an element, or anything above it, is hidden from assistive technology. */
const hiddenFromAssistiveTech = (svg) => {
  for (let node = svg; node; node = node.parentNode) {
    if (node.getAttribute?.('aria-hidden') === 'true') return true;
  }
  return false;
};

const titles = new Map();
const descriptions = new Map();
const paragraphs = new Map();
const pagePhotoNames = new Map();
const photoSources = new Map();
const externalLinks = new Set();
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

  // Photographs: the attributes that make a picture understandable to a crawler and a person.
  const photoImgs = images.filter((img) =>
    /static%2Fmedia%2F[^&]*\.jpg/i.test(img.getAttribute('src') ?? ''),
  );
  const photoNames = photoImgs.map(
    (img) => /static%2Fmedia%2F([a-z0-9-]+)\./i.exec(img.getAttribute('src') ?? '')?.[1] ?? '',
  );
  pagePhotoNames.set(page.path, new Set(photoNames));
  for (const [i, img] of photoImgs.entries()) {
    const name = photoNames[i];
    if (name && !photoSources.has(name))
      photoSources.set(name, (img.getAttribute('src') ?? '').replaceAll('&amp;', '&'));
  }
  const footerText = (root.querySelector('footer')?.text ?? '').replace(/\s+/g, ' ');
  check(
    group,
    'footer states that photographs are stock images of models, not members',
    /stock images of models, not VYRA members/.test(footerText),
  );
  if (photoImgs.length > 0) {
    const alts = photoImgs.map((img) => img.getAttribute('alt') ?? '');
    check(
      group,
      'photographs have long descriptive alt text (50+ characters), unique on the page',
      alts.every((alt) => alt.length >= 50) && new Set(alts).size === alts.length,
      alts.map((alt) => alt.length).join(','),
    );
    check(
      group,
      'photographs describe, and do not name or promise, anything',
      alts.every((alt) => !/\b(vyra|member|user|match(ed)?|couple who|real)\b/i.test(alt)),
    );
    check(
      group,
      'photograph file names are descriptive words, not hashes',
      photoNames.every((name) => name.split('-').length >= 3),
      photoNames.join(' '),
    );
    check(
      group,
      'photographs declare srcset and sizes for responsive delivery',
      photoImgs.every((img) => img.getAttribute('srcset') && img.getAttribute('sizes')),
    );
    check(
      group,
      'at most two photographs load eagerly; the rest are lazy',
      photoImgs.filter((img) => img.getAttribute('loading') === 'eager').length <= 2 &&
        photoImgs.every((img) => ['eager', 'lazy'].includes(img.getAttribute('loading') ?? '')),
    );
    const captioned = photoImgs.map((img) => {
      let node = img.parentNode;
      while (node && node.rawTagName !== 'figure') node = node.parentNode;
      return node?.querySelector('figcaption') ?? null;
    });
    check(
      group,
      'every photograph with a caption labels itself a stock photo',
      captioned.every((caption) => caption === null || /Stock photo/.test(caption.text)),
    );
    check(
      group,
      'at least one photograph on the page carries a visible caption',
      captioned.some(Boolean),
    );
  }
  const svgs = root.querySelectorAll('svg');
  const unlabelled = svgs.filter(
    (svg) =>
      !hiddenFromAssistiveTech(svg) &&
      !(svg.getAttribute('role') === 'img' && Boolean(svg.getAttribute('aria-label'))),
  );
  check(
    group,
    'every inline SVG is hidden from assistive technology or has a role and label',
    unlabelled.length === 0,
    `${unlabelled.length} unlabelled`,
  );

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
    'has a WebPage or Article entry',
    types.some((type) =>
      ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'Article'].includes(type),
    ),
  );
  if (page.path !== '/') {
    const crumbs = parsed.find((item) => item['@type'] === 'BreadcrumbList');
    const items = crumbs?.itemListElement ?? [];
    const visibleCrumbs = root
      .querySelectorAll('nav[aria-label="Breadcrumb"] li')
      .filter((li) => li.getAttribute('aria-hidden') !== 'true');
    check(
      group,
      'BreadcrumbList matches the visible breadcrumb',
      items.length === visibleCrumbs.length &&
        items.length === (page.article ? 3 : 2) &&
        items.every((item, i) => item.position === i + 1 && item.name),
    );
    if (!expectPreview)
      check(
        group,
        'breadcrumb ends at the canonical URL',
        items.at(-1)?.item === canonicalFor(page.path),
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
  // The lead photograph's structured data must describe a picture that is on the page.
  const imageObject = parsed.find((item) => item['@type'] === 'ImageObject');
  if (imageObject) {
    const leadName = /media\/([a-z0-9-]+)\./i.exec(imageObject.contentUrl ?? '')?.[1];
    check(
      group,
      'ImageObject describes a photograph that is visible on the page',
      Boolean(leadName) && photoNames.includes(leadName),
    );
    check(
      group,
      'ImageObject has a credit, dimensions, a name and a stable @id',
      Boolean(imageObject.creditText) &&
        Number(imageObject.width) > 0 &&
        Number(imageObject.height) > 0 &&
        Boolean(imageObject.name) &&
        String(imageObject['@id']).endsWith('#primaryimage'),
    );
    if (!expectPreview)
      check(
        group,
        'ImageObject URL is on the production origin',
        String(imageObject.contentUrl).startsWith(`${origin}/`),
        imageObject.contentUrl,
      );
    const lead = parsed.find((item) =>
      ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage'].includes(item['@type']),
    );
    const article = parsed.find((item) => item['@type'] === 'Article');
    check(
      group,
      'the page or article points at its ImageObject',
      (lead && lead.primaryImageOfPage?.['@id'] === imageObject['@id']) ||
        (article && article.image === imageObject.contentUrl),
    );
  }

  // Entity consistency: one description of VYRA, everywhere.
  const organizations = parsed.filter((item) => item['@type'] === 'Organization');
  check(
    group,
    'exactly one Organization entity, with the canonical description',
    organizations.length === 1 && organizations[0].description === ENTITY_DESCRIPTION,
  );
  check(
    group,
    'Organization and WebSite use stable @id values',
    organizations[0]?.['@id']?.endsWith('/#organization') &&
      parsed.find((item) => item['@type'] === 'WebSite')?.['@id']?.endsWith('/#website'),
  );
  check(
    group,
    'Organization has no unverified facts (founder, address, rating, awards)',
    !/"(founder|foundingDate|address|award|aggregateRating|numberOfEmployees|legalName|taxID)"/.test(
      JSON.stringify(organizations),
    ),
  );
  const mainText = (main?.text ?? '').replace(/\s+/g, ' ');
  check(
    group,
    'never describes VYRA as a different kind of product',
    !WRONG_CATEGORY.test(mainText),
  );
  const claim = FORBIDDEN_CLAIMS.map((pattern) => pattern.exec(mainText)?.[0]).find(Boolean);
  check(group, 'makes no superlative, guarantee or user-number claim', !claim, claim ?? '');

  // Paragraphs, for the duplicate-content check below.
  // Teasers in <aside> and reference lists are navigation and citations, not body copy.
  for (const p of main?.querySelectorAll('p') ?? []) {
    if (p.closest('aside') || p.closest('[data-references]')) continue;
    const copy = p.text.replace(/\s+/g, ' ').trim();
    if (copy.length < 140) continue;
    if (!paragraphs.has(copy)) paragraphs.set(copy, new Set());
    paragraphs.get(copy).add(page.path);
  }

  if (page.article) {
    const article = parsed.find((item) => item['@type'] === 'Article');
    check(group, 'has Article structured data', Boolean(article));
    check(
      group,
      'Article headline equals the visible h1',
      article?.headline === h1[0]?.text.trim(),
      article?.headline,
    );
    const dates = [article?.datePublished, article?.dateModified];
    check(
      group,
      'Article has valid published and modified dates, not in the future',
      dates.every(
        (d) => d && !Number.isNaN(Date.parse(d)) && Date.parse(d) <= Date.now() + 864e5,
      ) && Date.parse(dates[1]) >= Date.parse(dates[0]),
    );
    const times = root.querySelectorAll('time').map((t) => t.getAttribute('datetime'));
    check(
      group,
      'the same dates are visible on the page',
      times.includes(article?.datePublished) && times.includes(article?.dateModified),
    );
    check(
      group,
      'author and publisher are the Organization, not an invented person',
      article?.author?.['@id']?.endsWith('/#organization') &&
        article?.publisher?.['@id']?.endsWith('/#organization') &&
        !types.includes('Person'),
    );
    check(
      group,
      'the page says who wrote it and that it is not expert-reviewed',
      /Written by/.test(mainText) && /Not reviewed by/.test(mainText),
    );
    check(
      group,
      'the direct answer comes before the first section',
      html.indexOf('The short answer') > -1 &&
        html.indexOf('The short answer') < html.indexOf('id="s1"'),
    );
    const answer = root.querySelector('header p.t-title')?.text.trim() ?? '';
    const answerWords = answer.split(/\s+/).length;
    check(
      group,
      'the direct answer is 35–80 words and stands alone',
      answerWords >= 35 && answerWords <= 80 && !/^(it|this|that|they)\b/i.test(answer),
      `${answerWords} words`,
    );
    const refs = root.querySelectorAll('a[rel~="external"]').map((a) => a.getAttribute('href'));
    check(
      group,
      'has at least two references with links',
      refs.length >= 2,
      `${refs.length} references`,
    );
    check(
      group,
      'Article citations are exactly the visible references',
      JSON.stringify(article?.citation ?? []) === JSON.stringify(refs),
    );
    for (const ref of refs) externalLinks.add(ref);
    check(group, 'og:type is article', meta(root, 'meta[property="og:type"]') === 'article');
    check(
      group,
      'links to VYRA product pages and to related articles',
      root.querySelectorAll('article a[href^="/"]').length >= 3 &&
        root.querySelectorAll('aside a[href^="/learn/"]').length >= 2,
    );
    check(
      group,
      'has a questions section and a limits statement',
      /Questions people also ask/.test(mainText) &&
        /limit|cannot|not known|no good evidence/i.test(mainText),
    );
  }

  const organization = organizations[0];
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

// Entity description is where people will look for it.
{
  const homeHtml = parse(await (await get('/')).text());
  const aboutHtml = parse(await (await get('/about')).text());
  check(
    'entity',
    'home meta description opens with the canonical category',
    (meta(homeHtml, 'meta[name="description"]') ?? '').startsWith(
      'VYRA is an AI-assisted relationship discovery platform',
    ),
  );
  check(
    'entity',
    'home answers “What is VYRA?” in visible text',
    /What is VYRA\?/.test(homeHtml.querySelector('main').text) &&
      homeHtml
        .querySelector('main')
        .text.includes('VYRA is an AI-assisted relationship discovery platform'),
  );
  check(
    'entity',
    'about page states the canonical description word for word',
    aboutHtml.querySelector('main').text.replace(/\s+/g, ' ').includes(ENTITY_DESCRIPTION),
  );
  check(
    'entity',
    'about page states what VYRA is not and its status',
    /What VYRA is not/.test(aboutHtml.querySelector('main').text) &&
      /In development/.test(aboutHtml.querySelector('main').text),
  );
  check(
    'entity',
    'footer carries the canonical description on every page',
    homeHtml.querySelector('footer').text.replace(/\s+/g, ' ').includes(ENTITY_DESCRIPTION),
  );
}

// Duplicate content: no long paragraph may appear on three or more pages.
const repeated = [...paragraphs].filter(([, where]) => where.size >= 3);
check(
  'content',
  'no paragraph is repeated across three or more pages',
  repeated.length === 0,
  repeated.map(([text, where]) => `${[...where].join(', ')}: ${text.slice(0, 60)}…`).join(' | '),
);
const twice = [...paragraphs].filter(([, where]) => where.size === 2).length;
check(
  'content',
  'paragraphs shared by two pages are rare (definitions only)',
  twice <= 10,
  `${twice} shared paragraphs`,
);

// External references resolve. Opt-in: it depends on other people's servers.
if (process.env.CHECK_EXTERNAL === '1') {
  for (const url of externalLinks) {
    let status = 0;
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (link check)' },
        signal: AbortSignal.timeout(20000),
      });
      status = response.status;
    } catch {
      status = 0;
    }
    // Publishers often refuse automated requests (403); only a missing page is a failure.
    check(
      'references',
      `${url} is not a dead link`,
      status !== 404 && status !== 410,
      `status ${status || 'unreachable from here'}`,
    );
  }
}

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
  // Only the general group: a training-crawler group may legitimately disallow everything.
  check(
    'robots.txt',
    'the general rule does not disallow the whole site',
    !/Disallow: \/\s*$/m.test(robotsText.split(/\n\s*\n/)[0]),
  );
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

  // Per-crawler policy, read the way a crawler reads it: its own group if named, else `*`.
  const groups = [];
  let current = null;
  for (const raw of robotsText.split('\n')) {
    const [field, ...rest] = raw.trim().split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(field)) {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (/^(allow|disallow)$/i.test(field) && current) {
      current.rules.push([field.toLowerCase(), value]);
    }
  }
  const allowed = (agent, path) => {
    const group =
      groups.find((g) => g.agents.includes(agent.toLowerCase())) ??
      groups.find((g) => g.agents.includes('*'));
    const matches = (group?.rules ?? [])
      .filter(([, prefix]) => prefix && path.startsWith(prefix))
      .toSorted((a, b) => b[1].length - a[1].length);
    return matches.length === 0 || matches[0][0] === 'allow';
  };
  const named = (agent) => groups.some((g) => g.agents.includes(agent.toLowerCase()));
  for (const agent of [
    'Googlebot',
    'Bingbot',
    'OAI-SearchBot',
    'PerplexityBot',
    'Claude-SearchBot',
    'ChatGPT-User',
    'Perplexity-User',
    'Claude-User',
  ]) {
    check(
      'robots.txt',
      `${agent} is named and may read public pages and assets, but not /api/`,
      named(agent) &&
        allowed(agent, '/') &&
        allowed(agent, '/learn/relationship-compatibility') &&
        allowed(agent, '/_next/static/x.css') &&
        !allowed(agent, '/api/x'),
    );
  }
  const training = process.env.EXPECT_TRAINING ?? 'unset';
  for (const agent of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot']) {
    if (training === 'unset')
      check('robots.txt', `${agent}: no decision recorded, so it is not named`, !named(agent));
    else
      check(
        'robots.txt',
        `${agent} is explicitly ${training}ed`,
        named(agent) && allowed(agent, '/') === (training === 'allow'),
      );
  }
  check(
    'robots.txt',
    'OAI-SearchBot and GPTBot are never in the same group',
    !groups.some((g) => g.agents.includes('oai-searchbot') && g.agents.includes('gptbot')),
  );
}

// llms.txt
const llms = await get('/llms.txt');
if (expectPreview) {
  check('llms.txt', 'is not served on a preview', llms.status === 404);
} else {
  const llmsText = await llms.text();
  check(
    'llms.txt',
    'is served as plain text',
    llms.status === 200 && (llms.headers.get('content-type') ?? '').includes('text/plain'),
  );
  check('llms.txt', 'is concise (under 8 KB)', llmsText.length < 8192, `${llmsText.length} bytes`);
  check(
    'llms.txt',
    'opens with the name and the canonical description',
    llmsText.startsWith('# VYRA') && llmsText.includes(ENTITY_DESCRIPTION),
  );
  check('llms.txt', 'states that VYRA is in development', /In development/.test(llmsText));
  const llmsLinks = [...llmsText.matchAll(/\]\((https?:[^)]+)\)/g)].map((m) => m[1]);
  check(
    'llms.txt',
    'links only to the production origin',
    llmsLinks.length > 5 &&
      llmsLinks.every((url) => url === origin || url.startsWith(`${origin}/`)),
  );
  const indexableUrls = new Set(PAGES.filter((p) => p.index).map((p) => canonicalFor(p.path)));
  check(
    'llms.txt',
    'lists only indexable pages',
    llmsLinks.every((url) => indexableUrls.has(url)),
    llmsLinks.filter((url) => !indexableUrls.has(url)).join(' '),
  );
  check(
    'llms.txt',
    'lists every indexable page',
    [...indexableUrls].every((url) => llmsLinks.includes(url)),
  );
  check(
    'llms.txt',
    'contains no private, internal or secret material',
    !/localhost|api[_-]?key|secret|token|password|\/api\/|prisma|postgres/i.test(llmsText),
  );
}
const expectKey = process.env.EXPECT_INDEXNOW === 'true';
check(
  'indexnow',
  `key file is ${expectKey ? 'served' : 'absent until a key is configured'}`,
  (await get('/indexnow-key.txt')).status === (expectKey ? 200 : 404),
);

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

// Image sitemap, and the pictures it lists.
if (!expectPreview) {
  const blocks = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  const byPage = new Map(
    blocks.map((block) => [
      /<loc>([^<]+)<\/loc>/.exec(block)?.[1],
      new Set(
        [...block.matchAll(/<image:loc>[^<]*?media\/([a-z0-9-]+)\.[^<]*<\/image:loc>/gi)].map(
          (m) => m[1],
        ),
      ),
    ]),
  );
  const wrong = [];
  for (const page of PAGES.filter((p) => p.index)) {
    const listed = byPage.get(canonicalFor(page.path)) ?? new Set();
    const shown = pagePhotoNames.get(page.path) ?? new Set();
    const missing = [...shown].filter((name) => !listed.has(name));
    const phantom = [...listed].filter((name) => !shown.has(name));
    if (missing.length || phantom.length)
      wrong.push(`${page.path}: missing [${missing}] phantom [${phantom}]`);
  }
  check(
    'sitemap.xml',
    'each page lists exactly the photographs it shows as sitemap images',
    wrong.length === 0,
    wrong.join(' | '),
  );
  const imageUrls = [
    ...new Set([...sitemapXml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1])),
  ];
  const bad = [];
  for (const url of imageUrls) {
    const response = await get(url.replace(origin, ''));
    if (
      response.status !== 200 ||
      !(response.headers.get('content-type') ?? '').startsWith('image/')
    )
      bad.push(url);
  }
  check(
    'images',
    `all ${imageUrls.length} sitemap images are served as images on the production origin`,
    imageUrls.length > 0 &&
      bad.length === 0 &&
      imageUrls.every((url) => url.startsWith(`${origin}/`)),
    bad.join(' '),
  );
}
// What a visitor is sent: modern format at a phone-to-laptop width, under a sensible weight.
for (const [name, src] of photoSources) {
  const target = new URL(src, base);
  target.searchParams.set('w', '1080');
  target.searchParams.set('q', '75');
  const response = await fetch(target, {
    headers: { accept: 'image/avif,image/webp,image/*' },
    redirect: 'manual',
  });
  const bytes = (await response.arrayBuffer()).byteLength;
  const type = response.headers.get('content-type') ?? '';
  check(
    'images',
    `${name} is delivered as AVIF or WebP at 1080 px, under 260 KB`,
    response.status === 200 && /avif|webp/.test(type) && bytes < 260 * 1024,
    `${type}, ${Math.round(bytes / 1024)} KB`,
  );
}
if (!expectPreview) {
  const credits = parse(await (await get('/about')).text());
  const creditLinks = credits.querySelectorAll(
    '#image-credits a[href^="https://www.magnific.com/"]',
  );
  check(
    'images',
    'the About page credits every photograph, with a link to its source',
    creditLinks.length >= photoSources.size && creditLinks.length > 0,
    `${creditLinks.length} credits for ${photoSources.size} photographs`,
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

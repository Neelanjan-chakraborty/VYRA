import { type PageDef, pages } from './routes';
import { absoluteUrl, defaultLocale, site } from './site';

const ORGANIZATION_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;

/**
 * Only what a visitor can verify on the page: the name, the address of this
 * site, the logo and the slogan. No ratings, prices, founders, addresses or
 * social profiles are published, so none are marked up.
 *
 * `SoftwareApplication` is deliberately absent: VYRA is not yet available to
 * install, and Google's guidelines for that type expect an offer and a rating.
 * Add it when there is a public release to describe.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: site.name,
    url: site.url,
    logo: absoluteUrl('/logo.png'),
    slogan: site.tagline,
    description: site.description,
    ...(site.contactEmail ? { email: site.contactEmail } : {}),
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: site.name,
    url: site.url,
    description: site.description,
    inLanguage: defaultLocale.code,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function webPageJsonLd(page: PageDef) {
  return {
    '@context': 'https://schema.org',
    '@type': page.schemaType ?? 'WebPage',
    '@id': `${absoluteUrl(page.path)}#webpage`,
    url: absoluteUrl(page.path),
    name: page.title,
    description: page.description,
    inLanguage: defaultLocale.code,
    dateModified: page.updated,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORGANIZATION_ID },
  };
}

export function breadcrumbJsonLd(page: PageDef) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: pages.home.label, item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: page.label, item: absoluteUrl(page.path) },
    ],
  };
}

/**
 * For future editorial pages (`/journal/...`). Unused until an article exists;
 * kept here so the first one is marked up the same way as everything else.
 */
export function articleJsonLd(article: {
  readonly path: string;
  readonly headline: string;
  readonly description: string;
  readonly datePublished: string;
  readonly dateModified: string;
  readonly image: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.headline,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    image: absoluteUrl(article.image),
    inLanguage: defaultLocale.code,
    mainEntityOfPage: absoluteUrl(article.path),
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, 'g');

/** JSON for a <script> element: `<`, `>`, `&` and line separators cannot end or break it. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATORS, (char) => `\\u${char.charCodeAt(0).toString(16)}`);
}

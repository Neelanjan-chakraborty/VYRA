import { type PageDef, pages } from './routes';
import { type PhotoKey, photos } from '@/content/photos';
import { entity } from './entity';
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
    logo: absoluteUrl(entity.logoPath),
    slogan: entity.tagline,
    description: entity.description,
    // Verified official profiles only (NEXT_PUBLIC_SAME_AS). Empty until some exist.
    ...(site.sameAs.length > 0 ? { sameAs: site.sameAs } : {}),
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

/** The picture that leads a page, with the credit shown beside it. Only used where it is visible. */
export function imageObjectJsonLd(photo: PhotoKey, path: string) {
  const item = photos[photo];
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    '@id': `${absoluteUrl(path)}#primaryimage`,
    name: item.title,
    url: absoluteUrl(item.image.src),
    contentUrl: absoluteUrl(item.image.src),
    width: item.image.width,
    height: item.image.height,
    description: item.alt,
    caption: item.caption,
    creditText: `${item.credit.author} on ${item.credit.via}`,
    representativeOfPage: true,
    inLanguage: defaultLocale.code,
  };
}

export function webPageJsonLd(page: PageDef, primaryImage?: PhotoKey) {
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
    ...(primaryImage
      ? { primaryImageOfPage: { '@id': `${absoluteUrl(page.path)}#primaryimage` } }
      : {}),
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

/** An educational article. The author is the organisation: no individual byline is verified. */
export function articleJsonLd(article: {
  readonly path: string;
  readonly photo: PhotoKey;
  readonly headline: string;
  readonly description: string;
  readonly datePublished: string;
  readonly dateModified: string;
  readonly citations: readonly string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${absoluteUrl(article.path)}#article`,
    headline: article.headline,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    image: absoluteUrl(photos[article.photo].image.src),
    inLanguage: defaultLocale.code,
    mainEntityOfPage: absoluteUrl(article.path),
    isPartOf: { '@id': WEBSITE_ID },
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    citation: article.citations,
  };
}

export function breadcrumbTrailJsonLd(
  trail: readonly { readonly name: string; readonly path: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
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

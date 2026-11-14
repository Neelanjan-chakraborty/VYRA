import type { Metadata, Route } from 'next';
import { absoluteUrl, defaultLocale, locales, site } from './site';

export interface PageDef {
  readonly path: Route;
  /** Short name for navigation and breadcrumbs. */
  readonly label: string;
  /** <title>. The root layout appends " — VYRA" unless `absoluteTitle` is set. */
  readonly title: string;
  readonly absoluteTitle?: boolean;
  readonly description: string;
  /** Last meaningful content change, ISO date. Feeds the sitemap. */
  readonly updated: string;
  /** False keeps the page out of the sitemap and marks it noindex. */
  readonly index: boolean;
  readonly schemaType?: 'WebPage' | 'AboutPage' | 'ContactPage';
}

/**
 * Every public page, once. Metadata, canonical URLs, the sitemap, navigation,
 * breadcrumbs and the SEO audit all read this list, so they cannot disagree.
 */
export const pages = {
  home: {
    path: '/',
    label: 'Home',
    title: 'VYRA — Dating built on compatibility, not swiping',
    absoluteTitle: true,
    description:
      'Chemistry isn’t a guessing game. VYRA is an AI dating app that suggests people by ' +
      'personality, communication and shared interests, and explains every suggestion.',
    updated: '2026-11-14',
    index: true,
  },
  features: {
    path: '/features',
    label: 'Features',
    title: 'Features: persona, compatibility and discovery',
    description:
      'What VYRA does today and what is still being built: an AI persona you approve, ' +
      'compatibility explained across six dimensions, and discovery without a swipe deck.',
    updated: '2026-11-14',
    index: true,
  },
  howItWorks: {
    path: '/how-it-works',
    label: 'How it works',
    title: 'How VYRA works, from sign-up to first suggestion',
    description:
      'Seven short steps: sign in with a one-time code, describe yourself, review the persona ' +
      'VYRA drafts, and say who you want to meet. Nothing is used until you approve it.',
    updated: '2026-11-14',
    index: true,
  },
  aiPersona: {
    path: '/ai-persona',
    label: 'AI persona',
    title: 'AI persona: a description of you that you approve',
    description:
      'VYRA drafts a persona from your profile or from the AI assistant you already use. You ' +
      'see what was stated, what was inferred and why, and can edit or delete all of it.',
    updated: '2026-11-14',
    index: true,
  },
  compatibility: {
    path: '/compatibility',
    label: 'Compatibility',
    title: 'Relationship compatibility, calculated and explained',
    description:
      'How VYRA estimates compatibility: hard limits first, then six weighted dimensions and ' +
      'ten everyday scenarios, each with its reasons. No AI guesswork and no predictions.',
    updated: '2026-11-14',
    index: true,
  },
  safety: {
    path: '/safety',
    label: 'Safety',
    title: 'Safety, privacy and the controls you keep',
    description:
      'Adults only, consent asked per purpose, approximate location, moderated photos and ' +
      'account deletion in the app. What VYRA protects today and what is still to come.',
    updated: '2026-11-14',
    index: true,
  },
  about: {
    path: '/about',
    label: 'About',
    title: 'About VYRA: why we are building it',
    description:
      'VYRA is a relationship discovery platform being built in the open about its limits: ' +
      'understand people first, explain every suggestion, and leave the decisions to them.',
    updated: '2026-11-14',
    index: true,
    schemaType: 'AboutPage',
  },
  contact: {
    path: '/contact',
    label: 'Contact',
    title: 'Contact VYRA',
    description:
      'How to reach the VYRA team about the product, privacy requests, safety concerns and ' +
      'press enquiries.',
    updated: '2026-11-14',
    // A contact page with no way to make contact is not worth indexing.
    index: site.contactEmail !== null,
    schemaType: 'ContactPage',
  },
  privacy: {
    path: '/privacy',
    label: 'Privacy',
    title: site.legalPublished ? 'Privacy policy' : 'Privacy policy (working draft)',
    description:
      'What personal data VYRA handles, why, how long it is kept, and how to see, change or ' +
      'delete it.',
    updated: '2026-11-14',
    index: site.legalPublished,
  },
  terms: {
    path: '/terms',
    label: 'Terms',
    title: site.legalPublished ? 'Terms of service' : 'Terms of service (working draft)',
    description:
      'The terms that apply to using VYRA: who can use it, what is expected, and what is not allowed.',
    updated: '2026-11-14',
    index: site.legalPublished,
  },
} as const satisfies Record<string, PageDef>;

export type PageKey = keyof typeof pages;
export const allPages: readonly PageDef[] = Object.values(pages);
export const indexablePages = allPages.filter((page) => page.index);

export const primaryNav: readonly PageDef[] = [
  pages.features,
  pages.howItWorks,
  pages.aiPersona,
  pages.compatibility,
  pages.safety,
];

/** Next.js metadata for a page: title, description, canonical, hreflang, Open Graph, robots. */
export function pageMetadata(key: PageKey): Metadata {
  const page: PageDef = pages[key];
  const url = absoluteUrl(page.path);
  const socialTitle = page.absoluteTitle ? page.title : `${page.title} — ${site.name}`;
  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: {
      canonical: url,
      // One entry per locale that really exists, plus x-default. Today that is en-IN only.
      languages: {
        ...Object.fromEntries(
          locales.map((locale) => [locale.code, absoluteUrl(`${locale.pathPrefix}${page.path}`)]),
        ),
        'x-default': url,
      },
    },
    openGraph: {
      type: 'website',
      siteName: site.name,
      locale: defaultLocale.openGraph,
      url,
      title: socialTitle,
      description: page.description,
    },
    twitter: { card: 'summary_large_image', title: socialTitle, description: page.description },
    // A non-indexable deployment is handled once, in the root layout.
    ...(page.index ? {} : { robots: { index: false, follow: true } }),
  };
}

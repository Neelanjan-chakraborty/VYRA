import { entity } from './entity';
import { env } from './env';

const LOCAL_ORIGIN = 'http://localhost:3100';

const deployment = env.VYRA_SITE_ENV ?? env.VERCEL_ENV ?? env.CONTEXT ?? 'development';
const isProduction = deployment === 'production';
const configuredUrl = env.NEXT_PUBLIC_SITE_URL ?? null;
const isLocal = /localhost|127\.0\.0\.1/.test(configuredUrl ?? '');

/**
 * A deployment is indexable only when it is production AND has been given its
 * real origin. Without NEXT_PUBLIC_SITE_URL a production deployment still
 * builds and serves (so a first deploy works), but as a preview: noindex, a
 * closed robots.txt and an empty sitemap. It never guesses a canonical domain.
 */
const indexable = isProduction && configuredUrl !== null && !isLocal;
if (isProduction && !indexable) {
  console.warn(
    '[vyra] NEXT_PUBLIC_SITE_URL is not set to the production origin, so this deployment is ' +
      'NOT indexable (noindex, robots.txt disallows all). Set it and redeploy to go live.',
  );
}

// Where assets and social images resolve while there is no canonical origin.
const hostUrl = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
const fallbackUrl = hostUrl ? `https://${hostUrl}` : LOCAL_ORIGIN;

/** Locales with real, translated content. Add one here only when its pages exist. */
export const locales = [{ code: 'en-IN', openGraph: 'en_IN', pathPrefix: '' }] as const;
export const defaultLocale = locales[0];

export const site = {
  name: entity.name,
  tagline: entity.tagline,
  description: entity.description,
  url: configuredUrl ?? fallbackUrl,
  indexable,
  appUrl: env.NEXT_PUBLIC_APP_URL ?? null,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
  legalPublished: env.VYRA_LEGAL_STATUS === 'published',
  gaMeasurementId: env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? null,
  googleSiteVerification: env.GOOGLE_SITE_VERIFICATION ?? null,
  bingSiteVerification: env.BING_SITE_VERIFICATION ?? null,
  indexNowKey: env.INDEXNOW_KEY ?? null,
  /** null = no decision recorded: training crawlers fall under the general rule. */
  aiTrainingCrawlers: env.VYRA_AI_TRAINING_CRAWLERS ?? null,
  sameAs: env.NEXT_PUBLIC_SAME_AS ?? [],
} as const;

/** Absolute canonical URL for a site path. The home page has no trailing slash. */
export function absoluteUrl(path: string): string {
  return path === '/' ? site.url : `${site.url}${path}`;
}

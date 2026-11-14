import { env } from './env';

const LOCAL_ORIGIN = 'http://localhost:3100';

const deployment = env.VYRA_SITE_ENV ?? env.VERCEL_ENV ?? env.CONTEXT ?? 'development';
const isProduction = deployment === 'production';

if (isProduction && !env.NEXT_PUBLIC_SITE_URL) {
  throw new Error(
    'NEXT_PUBLIC_SITE_URL is required for a production deployment: canonical URLs, the sitemap ' +
      'and robots.txt are built from it. Set it to the verified production origin.',
  );
}
if (isProduction && /localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_SITE_URL ?? '')) {
  throw new Error('NEXT_PUBLIC_SITE_URL must not point at localhost in production.');
}

/** Locales with real, translated content. Add one here only when its pages exist. */
export const locales = [{ code: 'en-IN', openGraph: 'en_IN', pathPrefix: '' }] as const;
export const defaultLocale = locales[0];

export const site = {
  name: 'VYRA',
  tagline: 'Chemistry, decoded.',
  positioning: 'Dynamic relationship intelligence',
  description:
    'VYRA is a relationship discovery app built on compatibility rather than swiping: a persona ' +
    'you approve, six explained dimensions of alignment, and AI that stays under your control.',
  url: env.NEXT_PUBLIC_SITE_URL ?? LOCAL_ORIGIN,
  /** Only a production deployment with a real origin may be indexed. */
  indexable: isProduction,
  appUrl: env.NEXT_PUBLIC_APP_URL ?? null,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
  legalPublished: env.VYRA_LEGAL_STATUS === 'published',
  gaMeasurementId: env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? null,
  googleSiteVerification: env.GOOGLE_SITE_VERIFICATION ?? null,
} as const;

/** Absolute canonical URL for a site path. The home page has no trailing slash. */
export function absoluteUrl(path: string): string {
  return path === '/' ? site.url : `${site.url}${path}`;
}

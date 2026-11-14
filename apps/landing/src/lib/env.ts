import { z } from 'zod';

/**
 * Everything the site reads from the environment, validated once.
 * See `apps/landing/.env.example` for what each value means.
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const schema = z.object({
  /** Canonical origin, e.g. https://example.com — no path, no trailing slash. */
  NEXT_PUBLIC_SITE_URL: optional(
    z.url().refine((value) => new URL(value).pathname === '/' && !value.endsWith('/'), {
      message: 'must be an origin with no path or trailing slash',
    }),
  ),
  /** `production` makes the deployment indexable. Anything else is treated as a preview. */
  VYRA_SITE_ENV: optional(z.enum(['production', 'preview', 'development'])),
  /** Where "Enter VYRA" leads once the app is publicly available. */
  NEXT_PUBLIC_APP_URL: optional(z.url()),
  /** Published only when set; the site never invents a contact address. */
  NEXT_PUBLIC_CONTACT_EMAIL: optional(z.email()),
  /** `published` once reviewed legal documents replace the drafts. */
  VYRA_LEGAL_STATUS: optional(z.enum(['draft', 'published'])),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: optional(z.string().regex(/^G-[A-Z0-9]+$/)),
  GOOGLE_SITE_VERIFICATION: optional(z.string().regex(/^[\w-]+$/)),
  // Set by hosts; used only to detect a production deployment.
  VERCEL_ENV: optional(z.string()),
  CONTEXT: optional(z.string()),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VYRA_SITE_ENV: process.env.VYRA_SITE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  VYRA_LEGAL_STATUS: process.env.VYRA_LEGAL_STATUS,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION,
  VERCEL_ENV: process.env.VERCEL_ENV,
  CONTEXT: process.env.CONTEXT,
});

if (!parsed.success) {
  throw new Error(`Invalid website environment:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;

# VYRA website

The public marketing site. A standalone Next.js 16 app (App Router, Tailwind CSS 4, Motion): it
shares nothing at runtime with the API or the mobile app and deploys on its own.

```bash
pnpm --filter @vyra/landing dev          # http://localhost:3100
pnpm --filter @vyra/landing build        # production build (static pages)
pnpm --filter @vyra/landing start        # serve the build on :3100
pnpm --filter @vyra/landing typecheck
pnpm --filter @vyra/landing seo:audit    # technical SEO audit of the running build
pnpm --filter @vyra/landing visual:check # browser check + screenshots (needs Playwright)
```

## Pages

`/`, `/features`, `/how-it-works`, `/ai-persona`, `/compatibility`, `/safety`, `/learn` and six
articles under it, `/about`, `/contact`, `/privacy`, `/terms`, plus a real 404. All are
prerendered as static HTML. Also served: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/og.png`
and, when a key is set, `/indexnow-key.txt`.

`src/lib/entity.ts` is the one description of VYRA; metadata, structured data, the footer, the
About page and `llms.txt` read it. `src/content/learn.ts` holds the articles and the rules for
adding one. See `docs/seo/geo-implementation.md`.

`src/lib/routes.ts` is the single list of pages. Titles, descriptions, canonical URLs,
hreflang, Open Graph, the sitemap, navigation and breadcrumbs are all generated from it. To add
a page, add it there, create `src/app/<path>/page.tsx` with
`export const metadata = pageMetadata('<key>')`, and add it to the page list in
`scripts/seo-audit.mjs`.

## Environment

Copy `.env.example` to `.env.local`. None of the values are secrets.

| Variable                        | Purpose                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Canonical origin, e.g. `https://example.com`. **Required in production**; the build fails without it                                                                                |
| `VYRA_SITE_ENV`                 | `production` makes the site indexable. Falls back to `VERCEL_ENV` or Netlify's `CONTEXT`. Anything else is a preview: noindex everywhere, `robots.txt` disallows all, empty sitemap |
| `NEXT_PUBLIC_APP_URL`           | Where "Enter VYRA" leads once the app is public. Until then it leads to `/how-it-works#availability`                                                                                |
| `NEXT_PUBLIC_CONTACT_EMAIL`     | Shown on `/contact`. Without it the page says no address exists yet and is noindex                                                                                                  |
| `VYRA_LEGAL_STATUS`             | `published` removes the draft notices from `/privacy` and `/terms` and lets them be indexed                                                                                         |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 ID. Enables the consent banner; the script loads only after the visitor agrees                                                                                                  |
| `GOOGLE_SITE_VERIFICATION`      | Search Console HTML-tag token                                                                                                                                                       |

The site never invents a domain, a contact address or legal details. Where one is missing the
page says so.

## What must be true before launch

- [ ] A production domain is chosen and set as `NEXT_PUBLIC_SITE_URL`; the host redirects
      HTTP → HTTPS and `www` ↔ apex to that one origin.
- [ ] `/privacy` and `/terms` are replaced with counsel-reviewed text (every `[bracketed]`
      passage filled in), then `VYRA_LEGAL_STATUS=published`.
- [ ] A monitored address is set as `NEXT_PUBLIC_CONTACT_EMAIL`.
- [ ] `NEXT_PUBLIC_APP_URL` points at the store listing or web app.
- [ ] Search Console verified, sitemap submitted; GA4 property created and `cta_click` with
      `cta = enter_vyra` marked as a key event.
- [ ] `seo:audit` re-run against the live domain (`docs/seo/seo-audit-report.md`, section 5).

## Deploying

**Vercel.** The repository root has a `vercel.json` that declares one service, this app, served
at `/`. Import the repository, leave the root directory as the repository root, and deploy. The
first deploy works with no variables and is not indexable. To go live, add
`NEXT_PUBLIC_SITE_URL` (and the others above) for the Production environment only, attach the
domain, and redeploy. If Vercel's project settings are used in place of `vercel.json`, set the
root directory to `apps/landing`.

Any other Node host that runs Next.js also works; nothing in the app is host-specific. Self-hosting:
`pnpm install --frozen-lockfile && pnpm --filter @vyra/landing build`, then
`pnpm --filter @vyra/landing start` behind a TLS proxy, Node 22.18 or newer.

## Analytics

Nothing loads without consent. With `NEXT_PUBLIC_GA_MEASUREMENT_ID` set, a banner asks once; a
"yes" loads GA4 with advertising signals denied. The choice can be changed on `/privacy`.

| Event          | When                                        | Parameters                         |
| -------------- | ------------------------------------------- | ---------------------------------- |
| `cta_click`    | Any element with `data-cta` is clicked      | `cta`, `cta_location`, `page_path` |
| `section_view` | A `[data-section]` is half on screen (once) | `section`, `page_path`             |

`cta: enter_vyra` is the sign-up intent. Page views, scroll depth and engagement time come
from GA4 enhanced measurement.

## Honest visuals

- App screenshots in `src/assets/screens` are real, from `scripts/capture-app-screens.cjs`
  (see `docs/design-reference/README.md`). Screens that are empty states in the build are shown
  empty and labelled.
- `src/content/engine-sample.json` is real output of `@vyra/compatibility-engine` for two
  invented profiles (`pnpm --filter @vyra/landing engine-sample`). Do not edit it by hand.
- Every capability carries a status: in the app today, engine built, in development, planned.
  Keep them current with `docs/IMPLEMENTATION_STATUS.md`.

## Design

Ink, ivory, cherry and oxblood; Instrument Serif for display and Manrope for text, the same
families as the app, self-hosted. Neutrals, radii, durations and easings come from
`@vyra/design-system` through `pnpm --filter @vyra/landing tokens`, which also checks every
text pairing against WCAG AA. Motion is limited to scroll parallax on screenshots, one-time
reveals, the orbit in the hero and the menu; all of it stops under `prefers-reduced-motion`.

# SEO audit report — VYRA website (`apps/landing`)

Run: 14 November 2026, in the cloud development container, against a production build
(`next build` + `next start`) of Next.js 16.4.6.

The site has no verified production domain yet, so the build under test used the reserved
placeholder origin `https://vyra.example` (`NEXT_PUBLIC_SITE_URL`) with
`VYRA_SITE_ENV=production`. Every URL below is derived from that variable; nothing in the code
names a domain. **Nothing here is a ranking or indexing guarantee.** It shows the site is
technically ready to be crawled; whether and where it ranks depends on Google, on content
quality over time, and on links the site has not yet earned.

## 1. Automated audit — `pnpm --filter @vyra/landing seo:audit`

`apps/landing/scripts/seo-audit.mjs` fetches every page over plain HTTP, with no browser, so it
sees what a crawler receives before JavaScript runs. Result: **508 of 508 checks passed.**

| Area             | Checks  | Passed  | Result   |
| ---------------- | ------- | ------- | -------- |
| `/`              | 44      | 44      | Pass     |
| `/features`      | 46      | 46      | Pass     |
| `/how-it-works`  | 46      | 46      | Pass     |
| `/ai-persona`    | 46      | 46      | Pass     |
| `/compatibility` | 46      | 46      | Pass     |
| `/safety`        | 46      | 46      | Pass     |
| `/about`         | 46      | 46      | Pass     |
| `/contact`       | 46      | 46      | Pass     |
| `/privacy`       | 46      | 46      | Pass     |
| `/terms`         | 46      | 46      | Pass     |
| `site`           | 2       | 2       | Pass     |
| `links`          | 13      | 13      | Pass     |
| `assets`         | 7       | 7       | Pass     |
| `redirects`      | 7       | 7       | Pass     |
| `status`         | 8       | 8       | Pass     |
| `robots.txt`     | 4       | 4       | Pass     |
| `sitemap.xml`    | 7       | 7       | Pass     |
| `headers`        | 2       | 2       | Pass     |
| **Total**        | **508** | **508** | **Pass** |

| Page             | Title                                                       | Length | Description length |
| ---------------- | ----------------------------------------------------------- | ------ | ------------------ |
| `/`              | VYRA — Dating built on compatibility, not swiping           | 49     | 161                |
| `/features`      | Features: persona, compatibility and discovery — VYRA       | 53     | 161                |
| `/how-it-works`  | How VYRA works, from sign-up to first suggestion — VYRA     | 55     | 163                |
| `/ai-persona`    | AI persona: a description of you that you approve — VYRA    | 56     | 160                |
| `/compatibility` | Relationship compatibility, calculated and explained — VYRA | 59     | 165                |
| `/safety`        | Safety, privacy and the controls you keep — VYRA            | 48     | 163                |
| `/about`         | About VYRA: why we are building it — VYRA                   | 41     | 156                |
| `/contact`       | Contact VYRA — VYRA                                         | 19     | 100                |
| `/privacy`       | Privacy policy (working draft) — VYRA                       | 37     | 95                 |
| `/terms`         | Terms of service (working draft) — VYRA                     | 39     | 94                 |

What the checks cover, per page: status 200; `lang="en-IN"`; title and description present
and within length; indexable or noindex as intended; exactly one canonical, absolute, on the
production origin; `hreflang` `en-IN` and `x-default`; Open Graph and Twitter tags including
an absolute image; no localhost or host preview domain in the head; exactly one `h1`; heading
levels that never skip; `header`, `nav`, `main`, `footer`; 150+ words of main content in the
raw HTML; every image with `alt`, `width` and `height`, and descriptive alt text; no vague
link text; every link and button named; JSON-LD that parses, uses schema.org, includes
Organization, WebSite, a WebPage type and (on inner pages) a BreadcrumbList matching the
visible breadcrumb; no ratings, reviews, prices or counts in structured data; JSON-LD that
cannot close its own script element.

Site-wide: titles and descriptions unique; every internal link and `#fragment` resolves;
every referenced stylesheet, script, image and social image loads; seven redirects return 308
to the right target (trailing slash, `/features/ai-persona`, `/home`, and so on); unknown URLs
including `/app` and `/admin` return a real 404 that is noindex; `robots.txt` allows the site,
does not block `/_next/` assets, and names the production sitemap; `sitemap.xml` lists exactly
the indexable pages as absolute URLs with valid `lastmod`, no duplicates, no noindex pages.

### Defects the audit found and that were fixed

| Found                                                                                                                | Fix                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Inner pages had no `og:image` or `twitter:image`: a page-level `openGraph` object replaced the root file-based image | The card is served from `/og.png` and referenced once, in `pageMetadata()` |
| Five meta descriptions were 167–168 characters                                                                       | Trimmed to 165 or fewer                                                    |
| `robots.txt` carried a non-standard `Host:` line                                                                     | Removed                                                                    |

### Preview and staging

The same script with `EXPECT=preview`, against a build with no production flag: **432 of 432
passed.** In that mode every page carries `noindex, nofollow` in both the robots meta tag and
an `X-Robots-Tag` header, `robots.txt` is `Disallow: /` with no sitemap line, and
`sitemap.xml` is empty. A production build with no `NEXT_PUBLIC_SITE_URL`, or with a localhost
URL, fails at build time instead of publishing wrong canonicals.

### Pages deliberately not indexed

| Page                 | Why                                                              | Becomes indexable when             |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| `/privacy`, `/terms` | Working drafts, not reviewed by a lawyer, marked as such on page | `VYRA_LEGAL_STATUS=published`      |
| `/contact`           | No verified contact address exists; the page says so             | `NEXT_PUBLIC_CONTACT_EMAIL` is set |

They are reachable and linked, carry `noindex, follow`, and are absent from the sitemap. Run
the audit with `EXPECT_LEGAL_INDEXED=true` / `EXPECT_CONTACT_INDEXED=true` once that changes.

## 2. Browser check — `pnpm --filter @vyra/landing visual:check`

Playwright (Chromium), all ten pages plus the 404, at 390 × 844 and 1440 × 900: **passed.** No
console errors, no failed requests, no horizontal overflow, no broken images, one `h1` on
every page, no content left hidden by a scroll animation, the mobile menu opens, closes on
Escape and closes on navigation, and under `prefers-reduced-motion` no animation is running.
Review screenshots are in `docs/design-reference/website/`.

## 3. Lighthouse 13 (lab)

Headless Chromium against `localhost`, default throttling (mobile: simulated slow 4G, 4× CPU).

| Page        | Form factor | Performance | Accessibility | Best practices | SEO | LCP   | CLS | TBT   |
| ----------- | ----------- | ----------- | ------------- | -------------- | --- | ----- | --- | ----- |
| `/`         | Mobile      | 100         | 100           | 100            | 100 | 0.9 s | 0   | 60 ms |
| `/`         | Desktop     | 100         | 100           | 100            | 100 | 0.3 s | 0   | 0 ms  |
| `/features` | Mobile      | 100         | 100           | 100            | 100 | 0.9 s | 0   | 30 ms |
| `/features` | Desktop     | 100         | 100           | 100            | 100 | 0.3 s | 0   | 0 ms  |

These are lab numbers from a server on the same machine, with no network distance and no
CDN in the way. They show there is no structural performance problem. They are **not** Core
Web Vitals: those are measured on real visitors and will only exist in Search Console and
CrUX after launch. INP in particular cannot be measured in the lab. Remaining Lighthouse
notes, none of which cost score: about 29 KiB of framework JavaScript not used on first load,
and one render-blocking stylesheet (the site's only CSS file).

## 4. Not done, because it needs a deployed site

| Check                                   | Status                                                                                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Rich Results Test                | Not run: it needs a public URL. JSON-LD is validated structurally by the audit. Note that Organization, WebSite and WebPage do not produce rich results by themselves; BreadcrumbList can |
| Google Search Console                   | Not set up: needs the production domain. The verification tag is wired to `GOOGLE_SITE_VERIFICATION`                                                                                      |
| Real Core Web Vitals (field data)       | Not available before real traffic                                                                                                                                                         |
| `www` ↔ apex and HTTP → HTTPS redirects | Host configuration, outside this app; listed in the deployment checklist                                                                                                                  |
| Social card previews on real platforms  | Not checked; `/og.png` renders correctly and is 1200 × 630                                                                                                                                |

## 5. After deployment

1. Set the environment (see `apps/landing/README.md`), deploy, and re-run
   `SITE_URL=https://<domain> pnpm --filter @vyra/landing seo:audit https://<domain>`.
2. Verify the domain in Search Console and submit `/sitemap.xml`.
3. Run the Rich Results Test on `/` and one inner page.
4. Check the coverage report after a week for anything unexpectedly excluded.
5. Review field Core Web Vitals once CrUX has data.

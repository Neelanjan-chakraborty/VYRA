# AEO and GEO audit report — VYRA website

Run: 14 November 2026, in the cloud development container, against a production build of
`apps/landing` (Next.js 16.4.6) using the placeholder origin `https://vyra.example`.
The site is **not deployed**. This report shows that it is technically ready to be crawled,
understood and cited. It does not show, and cannot show, that any search engine or AI product
has crawled, indexed, cited or recommended it. **No citation, recommendation or ranking is
promised.**

## 1. Gaps found in the first version, and what was done

| Gap                                                                                          | Fix                                                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| VYRA was called "an AI dating app" in the home description and something else on other pages | One entity definition (`src/lib/entity.ts`) used everywhere; the audit fails on any other category           |
| No page answered "What is VYRA?" directly                                                    | Answer block under the home hero; fact sheet, capabilities and "What VYRA is not" on About                   |
| No educational content; long-tail questions were answered only inside product pages          | `/learn` hub and six sourced articles                                                                        |
| `robots.txt` had one rule for every crawler                                                  | Search, user-requested and training crawlers are separate groups; training is an explicit, documented choice |
| No Article markup, no dates, no sources                                                      | Article JSON-LD with dates, Organization author and citations that match the visible references              |
| No Bing verification, IndexNow, crawler logging or AI referral tracking                      | All added, each behind an environment variable or consent                                                    |
| A production deploy without a domain failed to build                                         | It now deploys as a non-indexable preview and logs a warning                                                 |
| The audit script ignored its base-URL argument when `--report` was absent                    | Fixed                                                                                                        |

## 2. Automated audit

`pnpm --filter @vyra/landing seo:audit`, with `CHECK_EXTERNAL=1`:
**1051 of 1051 checks passed.**

| Area                                   | Checks   | Passed   | Result   |
| -------------------------------------- | -------- | -------- | -------- |
| `/`                                    | 49       | 49       | Pass     |
| `/features`                            | 51       | 51       | Pass     |
| `/how-it-works`                        | 51       | 51       | Pass     |
| `/ai-persona`                          | 51       | 51       | Pass     |
| `/compatibility`                       | 51       | 51       | Pass     |
| `/safety`                              | 51       | 51       | Pass     |
| `/learn`                               | 51       | 51       | Pass     |
| `/learn/relationship-compatibility`    | 64       | 64       | Pass     |
| `/learn/personality-and-relationships` | 64       | 64       | Pass     |
| `/learn/communication-styles`          | 64       | 64       | Pass     |
| `/learn/ai-in-relationship-discovery`  | 64       | 64       | Pass     |
| `/learn/dating-beyond-swiping`         | 64       | 64       | Pass     |
| `/learn/online-dating-safety`          | 64       | 64       | Pass     |
| `/about`                               | 51       | 51       | Pass     |
| `/contact`                             | 51       | 51       | Pass     |
| `/privacy`                             | 51       | 51       | Pass     |
| `/terms`                               | 51       | 51       | Pass     |
| `site`                                 | 2        | 2        | Pass     |
| `entity`                               | 5        | 5        | Pass     |
| `content`                              | 2        | 2        | Pass     |
| `references`                           | 12       | 12       | Pass     |
| `links`                                | 20       | 20       | Pass     |
| `assets`                               | 7        | 7        | Pass     |
| `redirects`                            | 7        | 7        | Pass     |
| `status`                               | 18       | 18       | Pass     |
| `robots.txt`                           | 17       | 17       | Pass     |
| `llms.txt`                             | 8        | 8        | Pass     |
| `indexnow`                             | 1        | 1        | Pass     |
| `sitemap.xml`                          | 7        | 7        | Pass     |
| `headers`                              | 2        | 2        | Pass     |
| **Total**                              | **1051** | **1051** | **Pass** |

| Page                                   | Title                                                         | Length | Description length |
| -------------------------------------- | ------------------------------------------------------------- | ------ | ------------------ |
| `/`                                    | VYRA — Relationship discovery built on compatibility          | 52     | 159                |
| `/features`                            | Features: persona, compatibility and discovery — VYRA         | 53     | 161                |
| `/how-it-works`                        | How VYRA works, from sign-up to first suggestion — VYRA       | 55     | 163                |
| `/ai-persona`                          | AI persona: a description of you that you approve — VYRA      | 56     | 160                |
| `/compatibility`                       | Relationship compatibility, calculated and explained — VYRA   | 59     | 165                |
| `/safety`                              | Safety, privacy and the controls you keep — VYRA              | 48     | 163                |
| `/learn`                               | Learn: compatibility, communication and AI in dating — VYRA   | 59     | 164                |
| `/learn/relationship-compatibility`    | What is relationship compatibility? A plain answer — VYRA     | 57     | 157                |
| `/learn/personality-and-relationships` | How does personality affect relationships? — VYRA             | 49     | 157                |
| `/learn/communication-styles`          | What is communication compatibility in a relationship? — VYRA | 61     | 155                |
| `/learn/ai-in-relationship-discovery`  | Can AI help with relationship compatibility? — VYRA           | 51     | 143                |
| `/learn/dating-beyond-swiping`         | Alternatives to swipe-based dating — VYRA                     | 41     | 160                |
| `/learn/online-dating-safety`          | What makes online dating safer? A guide for India — VYRA      | 56     | 155                |
| `/about`                               | About VYRA: why we are building it — VYRA                     | 41     | 162                |
| `/contact`                             | Contact VYRA — VYRA                                           | 19     | 100                |
| `/privacy`                             | Privacy policy (working draft) — VYRA                         | 37     | 95                 |
| `/terms`                               | Terms of service (working draft) — VYRA                       | 39     | 94                 |

### Checks added for AEO and GEO

| Requirement                    | How it is checked                                                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consistent description of VYRA | One Organization per page whose description equals the canonical sentence; the same sentence in the footer, on About and in `llms.txt`; the home description opens with the category                                               |
| No conflicting category        | Fails if any page says VYRA is a chatbot, AI companion, social network or matchmaking engine                                                                                                                                       |
| No incorrect product claims    | Fails on superlatives, guarantees, user or download numbers, "download now", "trusted by", "as seen in", ratings                                                                                                                   |
| No unverified company facts    | Fails if Organization markup carries a founder, address, founding date, legal name, award or rating                                                                                                                                |
| Answer first                   | On every article the direct answer precedes the first section, is 35–80 words and does not open with a pronoun                                                                                                                     |
| Author and source information  | Every article shows who wrote it, that it is not expert-reviewed, published and updated dates, and at least two linked references                                                                                                  |
| Markup matches the page        | Article headline equals the H1; dates equal the visible `<time>` values; `citation` equals the visible reference links; breadcrumb markup equals the visible breadcrumb                                                            |
| No invented author             | Author and publisher must be the Organization; a `Person` fails                                                                                                                                                                    |
| Duplicate content              | No paragraph of 140+ characters on three or more pages; at most ten shared by two                                                                                                                                                  |
| References alive               | Every reference URL fetched; a 404 or 410 fails (12 checked)                                                                                                                                                                       |
| Internal graph                 | Each article links to product pages and at least two related articles; every internal link and fragment resolves (20 targets)                                                                                                      |
| Crawler policy                 | `robots.txt` parsed as a crawler would: eight search and user agents named, allowed on pages and `/_next/` assets, refused on `/api/`; training agents match the configured decision; OAI-SearchBot and GPTBot never share a group |
| `llms.txt`                     | Plain text, under 8 KB, canonical description, development status stated, only and all indexable pages, production origin only, nothing private                                                                                    |
| No private surface             | `/app`, `/admin`, `/dashboard`, `/login`, `/account`, `/api/users` return 404                                                                                                                                                      |
| Server-rendered content        | 150+ words of main content in the raw HTML of every page, fetched without a browser                                                                                                                                                |

### Other deployment modes

| Mode                                                                   | Result                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Preview (no production flag)                                           | 894 of 894: noindex everywhere, `Disallow: /`, empty sitemap, no `llms.txt` |
| Production flag without `NEXT_PUBLIC_SITE_URL` (a first Vercel deploy) | 894 of 894: builds, serves, stays non-indexable                             |
| `VYRA_AI_TRAINING_CRAWLERS=disallow`, IndexNow key set                 | 1039 of 1039 (external link check off)                                      |
| `VYRA_AI_TRAINING_CRAWLERS=allow`                                      | 1039 of 1039 (external link check off)                                      |

## 3. Structured data validation

Validated structurally by the audit on all 17 pages: every block parses, uses the schema.org
context, and cannot terminate its script element. Types in use: Organization and WebSite on
every page; WebPage, AboutPage, ContactPage or CollectionPage on standard pages; Article on the
six articles; BreadcrumbList on every page but the home page. No ratings, reviews, offers,
prices or people.

**Not run:** Google's Rich Results Test and the Schema.org validator. Both need a public URL
or a manual paste. Run them on `/` and one article after deployment. Only BreadcrumbList and
Article are types Google may show as an enhancement, and it may choose not to.

## 4. Browser and performance

Playwright, 13 pages at 390 and 1440 pixels wide: passed. No console errors, no overflow, no
broken images, one H1 per page, nothing left hidden by an animation, reduced motion honoured.

Lighthouse 13, mobile, lab, localhost:

| Page                                | Performance | Accessibility | Best practices | SEO | LCP   | CLS | TBT    |
| ----------------------------------- | ----------- | ------------- | -------------- | --- | ----- | --- | ------ |
| `/`                                 | 100         | 100           | 100            | 100 | 0.9 s | 0   | 80 ms  |
| `/learn/relationship-compatibility` | 99          | 100           | 100            | 100 | 0.9 s | 0   | 110 ms |

Lab figures on the same machine as the server. They are not field Core Web Vitals.

## 5. Crawler logging

Verified locally: a request with OpenAI's search crawler user agent produced
`{"event":"crawler_visit","crawler":"OAI-SearchBot","path":"/learn",…}` in the server log, and
an ordinary browser request produced nothing. On Vercel these lines appear in the project's
logs. Log retention there is short; add a log drain to keep history.

## 6. Limits of this audit

- Citations by AI products cannot be tested before deployment, and for most products cannot be
  measured automatically at all. `ai-visibility-benchmark.md` is the manual process.
- Two official sources could not be read: OpenAI's publisher FAQ (access refused) and Bing's
  help pages (not retrievable by an automated fetch). Nothing is asserted from them.
- The articles were written by the VYRA team with verified references, but have had no expert
  review, and say so on the page.
- The forbidden-claims check is a list of patterns. It catches the obvious; it does not replace
  reading the copy.
- Deployment on Vercel through `vercel.json` has not been exercised from here.

## 7. Outstanding, all outside the repository

| Item                                                                                   | Who                     | Notes                                 |
| -------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------- |
| Production domain → `NEXT_PUBLIC_SITE_URL`                                             | Product owner           | Until set, the site is not indexable  |
| Decision on training crawlers → `VYRA_AI_TRAINING_CRAWLERS`                            | Product owner           | `geo-implementation.md`, section 4    |
| Google Search Console → `GOOGLE_SITE_VERIFICATION`, submit sitemap                     | Whoever owns the domain |                                       |
| Bing Webmaster Tools → `BING_SITE_VERIFICATION`, submit sitemap, review AI Performance | Same                    |                                       |
| IndexNow key → `INDEXNOW_KEY`, then `pnpm --filter @vyra/landing indexnow`             | Same                    | After each content change             |
| GA4 → `NEXT_PUBLIC_GA_MEASUREMENT_ID`; mark `cta_click` as a key event                 | Same                    | `ai_referral` arrives automatically   |
| Verified social profiles → `NEXT_PUBLIC_SAME_AS`                                       | Product owner           | Use the canonical description in each |
| Reviewed legal text, contact address                                                   | Product owner, counsel  | Pages stay noindex until then         |
| Expert review of Learn articles                                                        | Product owner           | Then add a real reviewer line         |
| First benchmark run                                                                    | Marketing               | Two to four weeks after launch        |

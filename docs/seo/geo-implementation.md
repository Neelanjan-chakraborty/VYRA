# AEO and GEO implementation — VYRA website

Written 14 November 2026. AEO (answer engine optimisation) means writing pages that answer a
question directly. GEO (generative engine optimisation) means making a site easy for
AI-powered search products to retrieve, understand and cite. Neither is a separate discipline
from good search practice, and **nothing here promises a citation, a recommendation or a
ranking.**

## 1. What the platforms actually say

Read on 14 November 2026. "Confirmed" means stated in the operator's own documentation.

| Source                                                                                                        | Status                                                                     | What it says                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)      | Read                                                                       | "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary." A page must be indexed and eligible for a snippet. No new machine-readable files, AI text files or special schema are needed. Controls are `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`. Traffic is counted in Search Console's Performance report under "Web" |
| [Google: AI optimisation guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) | Read                                                                       | SEO best practice still applies. AI features use retrieval (grounding) and query fan-out. On `llms.txt` and similar files: not needed, and "Google Search ignores them". Rewriting or "chunking" content for AI is described as unnecessary                                                                                                                                                       |
| [Google: common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) | Read                                                                       | `Google-Extended` is a control token, not a crawler. It governs use for training Gemini models and grounding in the Gemini app and Vertex AI. It "does not impact a site's inclusion in Google Search" and is not a ranking signal                                                                                                                                                                |
| [OpenAI: crawlers](https://developers.openai.com/api/docs/bots)                                               | Read                                                                       | Three separate agents. `OAI-SearchBot`: surfaces sites in ChatGPT search; a site that opts out "will not be shown in ChatGPT search answers". `GPTBot`: content "that may be used in training". `ChatGPT-User`: a user-initiated fetch, not automatic crawling; robots.txt rules "may not apply". Changes take about 24 hours. IP ranges are published as JSON                                    |
| OpenAI: publishers and developers FAQ                                                                         | **Not read** (the page refused automated access, HTTP 403)                 | Nothing from it is relied on here. Read it by hand before finalising referral tracking                                                                                                                                                                                                                                                                                                            |
| [Perplexity: crawlers](https://docs.perplexity.ai/guides/bots)                                                | Read                                                                       | `PerplexityBot` surfaces and links sites in Perplexity results and "is not used to crawl content for AI foundation models". `Perplexity-User` is a user-requested fetch that "generally ignores robots.txt rules". Changes take up to 24 hours                                                                                                                                                    |
| [Anthropic: crawlers](https://support.claude.com/en/articles/8896518)                                         | Read                                                                       | `ClaudeBot`: may contribute to training. `Claude-SearchBot`: search quality. `Claude-User`: user-requested fetch. All honour robots.txt                                                                                                                                                                                                                                                           |
| Bing Webmaster Guidelines; Bing "AI Performance" help                                                         | **Not read** (the help site returned an empty shell to an automated fetch) | Nothing is asserted about their contents. Section 7 lists what to confirm in the dashboard                                                                                                                                                                                                                                                                                                        |

### What follows from that

- **Confirmed requirement:** be crawlable, indexable and snippet-eligible, with the main content
  in the HTML. This is ordinary technical SEO and it is the whole of the technical requirement.
- **Confirmed controls:** robots.txt per crawler token; robots meta tags.
- **Recommendation (ours, not a platform's):** answer the question first, define terms, state
  limits, cite sources, keep one consistent description of the brand.
- **Experiment:** `llms.txt`. No search or AI product requires it and Google ignores it.

## 2. What was implemented

| Area             | Change                                                                                                                                           | Where                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Entity           | One source of truth for name, category, description, audience, market, status and capabilities                                                   | `src/lib/entity.ts`                                                      |
| Entity           | Site description, Organization JSON-LD, footer, About page, "What is VYRA?" answers and `llms.txt` all read from it                              | `site.ts`, `json-ld.ts`, `site-footer.tsx`, `about/page.tsx`, `page.tsx` |
| Answer-first     | "What is VYRA?" directly under the home hero; fact sheet, capabilities, "What VYRA is not" and "Is VYRA an AI dating app?" on About              | `components/answer.tsx`                                                  |
| Content hub      | `/learn` and six sourced articles, each with a direct answer, definition, explanation, example, limits, questions, references and related links  | `src/content/learn.ts`, `src/app/learn`                                  |
| Internal links   | Learn in the navigation; "From the Learn library" on home and five product pages; each article links to product pages and three related articles | `components/further-reading.tsx`                                         |
| Structured data  | Article with dates, Organization author and `citation`; three-level BreadcrumbList; CollectionPage for the hub; optional verified `sameAs`       | `src/lib/json-ld.ts`                                                     |
| Crawlers         | Per-crawler robots policy with search, user and training agents kept apart                                                                       | `src/lib/crawlers.ts`, `src/app/robots.ts`                               |
| Machine-readable | `/llms.txt`, generated, under 8 KB, indexable pages only                                                                                         | `src/app/llms.txt/route.ts`                                              |
| Bing             | Verification tag, IndexNow key file and submission script                                                                                        | `layout.tsx`, `indexnow-key.txt/route.ts`, `scripts/indexnow.mjs`        |
| Monitoring       | Crawler visits logged as JSON lines; `ai_referral` analytics event                                                                               | `src/proxy.ts`, `components/analytics.tsx`                               |
| Deploy           | `vercel.json`; a production deploy without a domain serves as a preview instead of failing                                                       | `vercel.json`, `src/lib/site.ts`                                         |
| Checks           | Audit extended from 508 to 1051 checks                                                                                                           | `scripts/seo-audit.mjs`                                                  |

## 3. The entity

> VYRA is an AI-assisted relationship discovery platform designed to help people understand
> personality, communication, interests and relationship compatibility.

That sentence is the Organization `description`, the footer line, the opening of the About
page and the first line of `llms.txt`. The category is always "AI-assisted relationship
discovery platform". "Dating app" is used only where the site explains the relationship
between the two ("Is VYRA an AI dating app?"), because people search with that phrase.

Deliberately absent, because none has been supplied: legal entity, founders, address, launch
date, user numbers, ratings, awards, partners and social profiles. `NEXT_PUBLIC_SAME_AS` adds
verified profile URLs to `sameAs` when they exist. Use the same sentence in those profiles.

## 4. Crawler policy

`/robots.txt` in production:

| Group                | Crawlers                                                           | Rule                                    |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| Everyone             | `*`                                                                | Allow `/`, disallow `/api/`             |
| Search and answer    | Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot | Allow `/`, disallow `/api/`             |
| User-requested fetch | ChatGPT-User, Perplexity-User, Claude-User                         | Allow `/`, disallow `/api/`             |
| Training             | GPTBot, ClaudeBot, Google-Extended, CCBot                          | **Follows `VYRA_AI_TRAINING_CRAWLERS`** |

`/_next/` is never disallowed. Previews and staging disallow everything and also send
`X-Robots-Tag: noindex, nofollow`. The site serves no private routes; `/app`, `/admin`,
`/dashboard`, `/login`, `/account` and `/api/users` are tested to return 404.

### Training crawlers: a decision for the product owner

This has **not** been decided, and the code does not decide it quietly. With the variable
unset, training crawlers are not named in robots.txt, so the general "allow" rule applies to
them: the ordinary state of a public website.

| Choice     | Effect                          | Trade-off                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allow`    | Named and allowed               | VYRA's public description may enter future model training, which may help models describe VYRA accurately without a search. The text is public marketing and educational copy, with no user data                                                                                                                                     |
| `disallow` | Named and disallowed            | The copy is kept out of training by compliant crawlers. Search visibility in ChatGPT, Perplexity and Claude is unaffected, since their search crawlers are separate. One cost: `Google-Extended` also governs grounding in the Gemini app, so VYRA may be less visible there. Google Search, AI Overviews and AI Mode are unaffected |
| unset      | Not named; general rule applies | Same practical effect as `allow`, without a recorded decision                                                                                                                                                                                                                                                                        |

User-requested fetchers may not obey robots.txt at all, by their operators' own account.

## 5. `llms.txt`

Implemented as an optional experiment, with expectations set accordingly: Google ignores it and
no product requires it. It costs nothing to maintain because it is generated from
`entity.ts` and the page registry. It contains the description, status, capabilities with their
build status, and links to indexable pages only. It is not served on previews. If it proves
useless, delete `src/app/llms.txt` and the audit's `llms.txt` checks.

## 6. Content rules for Learn

1. One article per distinct question. Six exist. `meaningful-connections` and
   `shared-interests-and-relationships` were **not** written: each would have repeated the
   compatibility and swiping articles. Their questions are answered inside those.
2. Every claim about research names a study in the references, and every reference was checked
   against Crossref or the publisher on 14 November 2026.
3. The byline is "The VYRA team", with "Not reviewed by a clinician or lawyer" shown. Add a
   `Person` author only for a real, verifiable person who has agreed to it.
4. VYRA's own approach is in a separate, labelled section, so the general explanation stands
   without the product.
5. No data about VYRA's members until there is some (`research-report-template.md`).
6. Update `updated` in `src/content/learn.ts` whenever the substance changes; it feeds the
   visible date, the Article markup and the sitemap.

### Structured data choices

- **FAQPage is not used.** Google shows FAQ rich results only for well-known government and
  health sites, and the questions are already plain visible text. Adding it would be markup for
  its own sake.
- **SoftwareApplication is not used.** VYRA cannot be installed yet. Add it at public release,
  with a real `offers` entry.
- Organization, WebSite, WebPage/AboutPage/CollectionPage, Article and BreadcrumbList are used,
  linked by stable `@id` values, and every value is visible on the page.

## 7. Monitoring

| What                | How                                                                                                                                                                 | Note                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crawler visits      | `src/proxy.ts` writes `{"event":"crawler_visit","crawler":…,"path":…}` to the host's logs. On Vercel: Logs, filter `crawler_visit`; add a log drain to keep history | A visit is not an index entry, a citation or a recommendation. User agents can be forged; confirm against the published IP ranges (`openai.com/searchbot.json`, `openai.com/gptbot.json`, `openai.com/chatgpt-user.json`, `perplexity.ai/perplexitybot.json`) |
| Google              | Search Console: verify with `GOOGLE_SITE_VERIFICATION`, submit `/sitemap.xml`. AI Overviews and AI Mode clicks are inside the normal Performance report             | Google's guide also names a generative-AI performance report; check whether the property has it                                                                                                                                                               |
| Bing and Copilot    | Bing Webmaster Tools: verify with `BING_SITE_VERIFICATION`, submit the sitemap, run `pnpm --filter @vyra/landing indexnow` after content changes                    | The AI Performance report could not be read from here. In the dashboard, confirm what it reports (cited pages, citation counts, grounding queries) and record it in the monthly template                                                                      |
| AI referrals        | GA4 event `ai_referral` with `ai_source` (chatgpt, perplexity, gemini, copilot, claude), from the referrer or `utm_source`. Consent-gated                           | Counts visits that arrive, not citations shown. Many AI visits carry no referrer and will be undercounted                                                                                                                                                     |
| Citations elsewhere | Manual, monthly: `ai-visibility-benchmark.md`                                                                                                                       | No public analytics exist for most products                                                                                                                                                                                                                   |
| Regressions         | `seo:audit` on every deploy                                                                                                                                         | Fails the run on any broken check                                                                                                                                                                                                                             |

## 8. India and languages

`lang="en-IN"`, `og:locale` `en_IN`, hreflang `en-IN` plus `x-default`, Indian English spelling
and India-specific safety resources (112, 1930, the cybercrime portal, the DPDP Act). There are
no city pages: VYRA has no members or services in any city to describe. For Hindi or Bengali,
add the locale to `locales` in `src/lib/site.ts` and build the translated routes; hreflang and
the sitemap follow. Publish a language only when it has been translated and reviewed by a
fluent editor.

## 9. Not done

- Nothing is deployed, so no crawler has visited and nothing is indexed or cited.
- No external accounts exist yet (Search Console, Bing Webmaster Tools, GA4, IndexNow key).
- Off-site authority is a plan, not an achievement: `brand-authority-plan.md`.
- Articles have had no expert review.

# Implementation status

Last updated: 14 November 2026, after the product-gap resolution (moderation, gender,
location, must-haves).

## Summary

| Milestone                     | Status                                           |
| ----------------------------- | ------------------------------------------------ |
| 0 — Audit and plan            | Done                                             |
| 1 — Foundation                | Done                                             |
| 2 — Design and authentication | Done, with the gaps listed below                 |
| 3 — AI Persona                | Done with the mock provider; Gemini unverified   |
| 4 — Compatibility             | Done                                             |
| Gap resolution (4 items)      | Done — see below                                 |
| 5 — Discovery                 | Started: first Discover list and profile preview |
| 6–8                           | Not started                                      |

## Product gap resolution — complete versus still needed

| Gap                      | Working end to end (verified)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Needs credentials or operations                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Photo moderation**  | Upload/replace checks (declared type vs bytes, size, dimensions); states PENDING → APPROVED / REJECTED / REVIEW_REQUIRED; real open-source classifier (nsfwjs) runs in the worker and approved a real upload in the browser run in ~4 s; appeal once; moderator queue and decisions (API); reports with hide-after-2; full history in `moderation_events` and `audit_logs`; scoped, re-checked media URLs; no unapproved photo in any recommendation, profile preview, compatibility response or URL (leak suite); Checking / In review / Declined in the app; neutral placeholder on Discover and profiles | Someone with the `MODERATOR` role to work the queue (no admin UI yet — API only). The classifier covers nudity/sexual content only; violence, minors and identity rely on reports and people |
| **2. Gender identity**   | Woman / Man / Non-binary / Self-describe (own words + searches to appear in) / Prefer not to say / unanswered; private unless shown; "show me" with an on-by-default option for people who describe their gender differently; migration converted existing data; rule enforced both ways; onboarding and Settings screens                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                            |
| **3. Location**          | Approximate device location (coarse permission only) or a city from 539 GeoNames places; ~2 km grid; never returned; bands only; removal clears all; distance only when both have a location; inactive filter explained in Discover and preferences; denied permission falls back to manual; bounding-box prefilter                                                                                                                                                                                                                                                                                         | Native permission prompts not seen on a device (web geolocation only). No places outside India yet — other countries are labels without distance                                             |
| **4. Must-haves**        | Must-have / Preference / Open for intentions, pace, weekends, communication style, values; must-haves never fire on unknown values; preferences only re-rank; private; impact notice when they remove ≥ half; onboarding and Settings editor with clear-all                                                                                                                                                                                                                                                                                                                                                 | —                                                                                                                                                                                            |
| **Discover (first cut)** | Ranked list and profile preview with photo or placeholder, distance band, estimated alignment in words, reasons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Connect / save / pass, Orbit: Milestone 5                                                                                                                                                    |

## What works today

**Marketing website (`apps/landing`).** A standalone Next.js 16 site: home, features, how it
works, AI persona, compatibility, safety, about, contact, and draft privacy and terms. Real app
screenshots (`docs/design-reference`), real engine output, full technical SEO (metadata,
canonicals, hreflang, sitemap, robots, JSON-LD) driven by one route registry, consent-gated
GA4, a Learn library of six sourced articles, a per-crawler robots policy, `llms.txt`,
IndexNow, crawler logging, and an automated audit (`docs/seo/aeo-geo-audit-report.md`:
1051/1051 checks, Lighthouse 99–100 in the lab). A root `vercel.json` deploys it on Vercel. Not deployed: there is no production domain, contact address or reviewed legal text
yet, so it builds as a non-indexable preview until those are set (`apps/landing/README.md`).

**New in Milestone 4 — compatibility.** `@vyra/compatibility-engine` scores any two people
deterministically from approved personas, intentions, interests and preferences: hard gates
in both directions (age, gender, distance, intention, personal deal-breakers, blocks), six
weighted dimensions, ten scenarios, plain-language reasons, and an honest "not enough to say"
when data is thin. The API serves `GET /v1/discovery/recommendations` (pgvector candidate pool,
confidence-aware ranking with diversity) and `GET /v1/compatibility/:userId`, caches results by
persona version and records impressions and views. Nothing in the app shows these yet — the
Discover and Orbit screens are Milestone 5.

**New in Milestone 3 — AI persona.** During onboarding (optional) or later under You → Your
persona, a person can:

- let VYRA draft a persona from their own bio, interests and intentions (consent required);
- **ask the AI assistant they already use**: pick ChatGPT, Gemini, Claude, DeepSeek, Copilot
  or another, copy VYRA's questionnaire into it, paste its answer back; VYRA reads only the
  answers, never keeps the reply, and never connects to the assistant;
- review the result split into **You told us / We inferred / Not known yet**, with confidence
  in words and the reason for every inference, and flags where sources disagree;
- confirm, change or remove anything, set boundaries only they can set, and approve — or
  discard; approval stores a 768-dimension embedding for matching;
- withdraw either AI consent (drafts are deleted at once) or delete the persona entirely.

API: persona and consent endpoints, BullMQ generation worker (in-process, or separately via
`dist/worker.js`), deterministic mock provider, Gemini adapter, calibration, questionnaire
parser. 12 attributes, none for sensitive traits.

**From Milestone 2:**

A person can sign up with an e-mail address or phone number, prove they are an adult, give
consent, build a profile with photos, interests, intentions and discovery preferences, use the
app shell, edit everything from the You tab, hide themselves, sign out, sign back in, and
delete their account.

- **Authentication**: one-time codes, registration with age gate and consent, 15-minute access
  tokens, rotating refresh tokens with theft detection, logout.
- **Profile**: profile fields, relationship intentions (including a custom one), discovery
  preferences, interest catalogue (36 seeded) and selection, onboarding completion.
- **Photos**: upload judged by content, re-encoded with location data removed, up to six,
  reorder, delete, served only through signed short-lived URLs.
- **Account deletion**: personal data and files removed immediately.
- **Mobile**: welcome screen with brand animation, sign-in, code entry, age, consent, five
  onboarding steps, You tab with settings, delete confirmation. Component library: Button,
  TextField, OtpInput, SelectRow, Tag, Stepper, Toggle, BottomSheet, FormScreen, notices.
- **Foundation** (Milestone 1): monorepo, validated configuration, 32-table schema, health
  probes, rate limiting, error envelope, design tokens, CI workflow.

## What is deliberately not there

- **Sign-in codes are not delivered.** The development sender returns the code to the app,
  which shows it on screen. Production refuses to start in this mode.
- **Photos are stored on local disk.** Production refuses to start in this mode.
- **Terms of Service and Privacy Policy documents do not exist**; the consent screen has
  nothing to link to.
- Orbit, Discover, Connections and Messages are still empty states.
- No discovery screens, connection requests, messaging, archive import, admin console.
- Recommendations carry no photos until photo moderation exists (Milestone 5).
- Locations are never collected yet, so the distance gate is inactive in practice.
- Photo moderation does not exist; photos are not yet shown to anyone but their owner.

## Verification (run 14 Nov 2026 in the cloud container)

| Check                             | Result                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check`, `pnpm lint`  | Pass                                                                                                                                             |
| `pnpm build`, `pnpm typecheck`    | Pass (5 packages)                                                                                                                                |
| `pnpm test`                       | Pass — 146 tests (validation 45, design-system 11, compatibility-engine 36, api 54 incl. the real nsfwjs model)                                  |
| `pnpm test:e2e`                   | Pass — 154 tests in 10 suites against real PostgreSQL, Redis and the queue                                                                       |
| `prisma migrate diff --exit-code` | Pass — no drift, 8 migrations                                                                                                                    |
| `expo export --platform web`      | Pass                                                                                                                                             |
| `pnpm e2e:web`                    | Pass — 33 screenshots; real moderation, gender, location (manual, device, denied, removed), must-haves, Discover placeholder then approved photo |

Regression matrix asked for in the gap directive, and where each is proven:

| Case                                           | Where                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Every gender option; not disclosing            | `gender.e2e-spec.ts`, engine `gender` tests                                         |
| No location permission                         | `e2e-web` (denied → manual), `location.e2e-spec.ts` (no location → filter inactive) |
| Manually selected location                     | `location.e2e-spec.ts`, `e2e-web`                                                   |
| No photos; pending, in-review, rejected photos | `photo-leak.e2e-spec.ts`, `e2e-web`                                                 |
| Several must-haves; none                       | `criteria.e2e-spec.ts`, engine must-have tests                                      |
| Preferences changed after onboarding           | gender, location and criteria suites                                                |
| No unapproved photo exposed                    | `photo-leak.e2e-spec.ts` (every state × every endpoint × every URL form)            |
| No unsupported distance filter                 | `location.e2e-spec.ts`                                                              |
| Gender filter doesn't wrongly exclude          | `gender.e2e-spec.ts`                                                                |
| Must-haves enforced consistently               | `criteria.e2e-spec.ts` (both directions, profile 404)                               |
| Existing auth, onboarding, discovery           | `auth`, `me`, `persona`, `compatibility` suites and `e2e-web`                       |

New in Milestone 4: the engine's synthetic-people tests (see `docs/COMPATIBILITY_ENGINE.md`
§9) and an API suite that builds eleven synthetic people through the public API and checks
the exact recommendation order, every exclusion (intention, age both ways, hidden, blocked,
deal-breaker, gender), honest insufficient results, symmetry, plain 404s for ineligible pairs,
cache keying and replacement on a new persona version, and recorded events.

New in Milestone 3, the API tests cover: consent required for each AI source; generation
through the real queue; evidence stored without raw profile text or contact details;
provider output with invented evidence, unknown or sensitive keys, AI-set boundaries and
invalid values filtered; garbage output retried once then failed with a code; empty profile;
edit / confirm / remove / approve / discard; supersession keeps one embedding; pasted replies
merged, disagreement flagged, the reply absent from the database and audit log; unusable
replies explained with nothing saved; oversize replies; consent withdrawal deleting drafts;
another person's persona inaccessible; persona and embedding removed on deletion. Unit tests
cover calibration, redaction, prompt containment against injection, the mock provider's
determinism and the reply parser (prose around JSON, two blocks, truncation, wrong version,
injected instructions).

`pnpm e2e:web` now also walks the onboarding "Help VYRA understand you" step, picks ChatGPT,
copies the questionnaire (checked via the real clipboard), pastes an unusable reply (error
shown), pastes a valid one, corrects an answer, approves, then later reviews and approves the
profile-based suggestions from Settings and switches profile reading off.

Not verified: the Gemini adapter against the live API (no key); the questionnaire against
real ChatGPT/Gemini/Claude/DeepSeek/Copilot replies (only hand-written replies in the format
the prompt asks for); iOS and Android native builds, including the native clipboard; the
GitHub Actions workflow; Docker Compose; screen readers on a device.

## Known issues and caveats

- Rate-limit counters are in process memory; fine for one instance only.
- `pnpm e2e:web` needs a minute between runs (it uses four of the five codes per minute).
- Typed routes: `apps/mobile/.expo/types` goes stale when routes change; delete it if
  typecheck complains about route strings.
- Photo reordering in the app is "show this one first", not drag and drop.
- The country code on the phone field is a pre-filled `+91`, not a country picker.
- Refresh on web uses `sessionStorage` (QA target only).
- A Gemini API key is still not saved in the environment; the app runs on the mock provider.
- E2E suites share the development database; several hide earlier test people at start. Test
  queues use their own Redis prefix, so a running dev server no longer takes test jobs.
- Fixed in Milestone 3: on web, tab screens grew with their content so the page scrolled
  under the tab bar. Tab screens now scroll inside their own frame.
- A removed attribute can be suggested again by the next generation (backlog).
- If storing an embedding fails, the persona is still approved without one (logged; no
  backfill job yet).

## Resume here

```bash
pnpm services:start
pnpm install
cp .env.example apps/api/.env      # if apps/api/.env is missing
pnpm db:deploy
pnpm build
pnpm check && pnpm test:e2e
```

Then continue Milestone 5 (`docs/IMPLEMENTATION_BACKLOG.md`): save / pass / connect APIs, the
connection lifecycle, Orbit, and the full compatibility screen.

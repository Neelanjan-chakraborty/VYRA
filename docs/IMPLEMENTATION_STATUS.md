# Implementation status

Last updated: 14 November 2026, end of Milestone 3.

## Summary

| Milestone                     | Status                                            |
| ----------------------------- | ------------------------------------------------- |
| 0 — Audit and plan            | Done                                              |
| 1 — Foundation                | Done                                              |
| 2 — Design and authentication | Done, with the gaps listed below                  |
| 3 — AI Persona                | Done with the mock provider; Gemini unverified    |
| 4 — Compatibility             | Not started (weights, tables and design doc only) |
| 5–8                           | Not started                                       |

## What works today

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
- No compatibility scoring, discovery, messaging, archive import, admin console.
- The approved persona is stored but nothing uses it yet; Milestone 4 will.
- Photo moderation does not exist; photos are not yet shown to anyone but their owner.

## Verification (run 14 Nov 2026 in the cloud container)

| Check                             | Result                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| `pnpm format:check`, `pnpm lint`  | Pass                                                          |
| `pnpm build`, `pnpm typecheck`    | Pass                                                          |
| `pnpm test`                       | Pass — 91 tests (validation 34, design-system 11, api 46)     |
| `pnpm test:e2e`                   | Pass — 87 tests against real PostgreSQL, Redis and the queue  |
| `prisma migrate diff --exit-code` | Pass — no drift, 3 migrations                                 |
| `expo export --platform web`      | Pass                                                          |
| `pnpm e2e:web`                    | Pass — 21 steps, 25 screenshots, no unexpected browser errors |
| `node dist/worker.js`             | Starts and connects (standalone worker)                       |

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
- Fixed in this milestone: on web, tab screens grew with their content so the page scrolled
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

Then start Milestone 4 (`docs/IMPLEMENTATION_BACKLOG.md`): the pure
`@vyra/compatibility-engine` package with synthetic-profile tests, scoring approved persona
versions only.

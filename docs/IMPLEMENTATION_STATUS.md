# Implementation status

Last updated: 15 November 2026, after chat features phase B (video, view once, timers, disappearing messages, blur, watermark, media consent, vault).

## Summary

| Milestone                     | Status                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------- |
| 0 — Audit and plan            | Done                                                                            |
| 1 — Foundation                | Done                                                                            |
| 2 — Design and authentication | Done, with the gaps listed below                                                |
| 3 — AI Persona                | Done with the mock provider; Gemini unverified                                  |
| 4 — Compatibility             | Done                                                                            |
| Gap resolution (4 items)      | Done — see below                                                                |
| 5 — Discovery                 | Done                                                                            |
| 6 — Social                    | Done; device push unverified                                                    |
| 7 — Advanced intelligence     | Part 1 done (Rust core, learning, gateway, compression); AI archive import next |
| 8                             | Not started                                                                     |

## Product gap resolution — complete versus still needed

| Gap                      | Working end to end (verified)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Needs credentials or operations                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Photo moderation**  | Upload/replace checks (declared type vs bytes, size, dimensions); states PENDING → APPROVED / REJECTED / REVIEW_REQUIRED; real open-source classifier (nsfwjs) runs in the worker and approved a real upload in the browser run in ~4 s; appeal once; moderator queue and decisions (API); reports with hide-after-2; full history in `moderation_events` and `audit_logs`; scoped, re-checked media URLs; no unapproved photo in any recommendation, profile preview, compatibility response or URL (leak suite); Checking / In review / Declined in the app; neutral placeholder on Discover and profiles | Someone with the `MODERATOR` role to work the queue (no admin UI yet — API only). The classifier covers nudity/sexual content only; violence, minors and identity rely on reports and people |
| **2. Gender identity**   | Woman / Man / Non-binary / Self-describe (own words + searches to appear in) / Prefer not to say / unanswered; private unless shown; "show me" with an on-by-default option for people who describe their gender differently; migration converted existing data; rule enforced both ways; onboarding and Settings screens                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                            |
| **3. Location**          | Approximate device location (coarse permission only) or a city from 539 GeoNames places; ~2 km grid; never returned; bands only; removal clears all; distance only when both have a location; inactive filter explained in Discover and preferences; denied permission falls back to manual; bounding-box prefilter                                                                                                                                                                                                                                                                                         | Native permission prompts not seen on a device (web geolocation only). No places outside India yet — other countries are labels without distance                                             |
| **4. Must-haves**        | Must-have / Preference / Open for intentions, pace, weekends, communication style, values; must-haves never fire on unknown values; preferences only re-rank; private; impact notice when they remove ≥ half; onboarding and Settings editor with clear-all                                                                                                                                                                                                                                                                                                                                                 | —                                                                                                                                                                                            |
| **Discover (first cut)** | Ranked list and profile preview with photo or placeholder, distance band, estimated alignment in words, reasons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Superseded by Milestone 5 below                                                                                                                                                              |

## What works today

**New in Milestone 7 (part 1) — Rust where it matters.**

- **Matchmaking core in Rust**, in-process (napi-rs). Identical results to the TypeScript
  reference on 2 000 fixture pairs, 60 rankings, and 3 000 fresh random pairs; all API tests run
  on it. Recommendations take one native call. Measured: ~1.5–1.8× faster for a 200-candidate
  pool through Node (Rust compute ~1 ms); single-pair calls ~40 µs slower (boundary cost).
- **Weight learning** in Rust: guarded logistic regression on what people did (save/connect/
  accept vs pass/decline), weekly or on demand, stored as a _proposal_ that an admin approves
  (`/v1/admin/weights`). Only dimension scores and outcomes are used.
- **Realtime gateway in Rust** (axum/tokio): WebSocket + MessagePack, Redis fan-out across
  instances, presence for push suppression, typing, per-device sign-out. Measured p50 4 ms /
  p99 12 ms publish→socket at 500 connections, ~10–13 KB per connection. Socket.IO removed.
- **Compression**: AVIF photos + 320 px thumbnails (~60 % smaller than JPEG at equal encode
  time), client-side resize before upload, voice re-encoded to 24 kbps speech Opus (+ CAF for
  iOS), brotli JSON, MessagePack frames, media caching by viewer.

**New in Milestone 6 — conversations.** Mutual connections can now talk:

- **Messages tab**: conversations most recent first, a quiet dot for something new (also on
  the tab), "Connection ended" when it's read-only. Reached from Connections › Mutual
  ("Message") or a connected profile.
- **Conversation**: live text (Socket.IO with the Redis adapter), "typing…", read ticks when
  both share receipts, optimistic sending with idempotent retries, older messages on scroll.
- **Photos** checked by the same classifier before the other person sees them; uncertain ones
  aren't delivered. **Voice notes** up to a minute (expo-audio; M4A on phones, WebM in
  browsers), playable inline. **Date ideas** the other person can accept or decline, with a
  safety line once accepted.
- **Wingman** (opt-in, its own consent): openers, replies or date ideas from what you both
  show on your profiles; recent messages only if you switch that on for the conversation.
  Suggestions go into the composer to edit; nothing is sent for you.
- **Per-conversation privacy**: read receipts (reciprocal), typing, Wingman's access, mute.
  Remove your own message for both; report theirs (hidden from you at once); end the
  connection or block from the conversation.
- **Notifications**: push registration after the first connection (Expo; needs a device
  build), "New message from …" — never content — and toggles under You → Notifications.

**New in Milestone 5 — discovery.** People can now act on what they see:

- **Orbit** (home tab): everyone recommended sits around you, closer the stronger the
  estimated alignment, with a dashed outer ring for "not enough to say yet". Pan and pinch,
  or use Zoom in / Zoom out / Re-centre; tap anyone to read their profile; "Show as a list"
  opens Discover. Positions are deterministic and unit-tested.
- **Discover**: counted filters (All, Strong, Shared interests, Nearby when distance exists)
  and Pass / Save on each card.
- **Deep Discover profile**: lead photo or placeholder, bio, "Why you might connect", "Where
  you differ", shared interests highlighted, and an action bar that follows where you stand —
  Pass / Save / Connect (with an optional note), Request sent · Withdraw, Accept / Decline,
  or Connected — plus Report and Block with confirmation.
- **Compatibility screen**: overall and confidence in words, six labelled dimension bars
  (no bar when there's nothing to say), ten everyday scenarios, shared interests, and the
  "estimate, not a prediction" caveat.
- **Connections**: Requests / Sent / Mutual / Saved with accept, decline, withdraw, end
  (confirmed) and unsave; notes shown only to their sender and recipient; no counters.
- **Blocked people** under You, with Unblock.
- The API behind it: save, pass (30 days), requests with notes, mutual auto-match, accept /
  decline (30-day cool-down) / withdraw, end, block / unblock, one visibility rule that keeps
  existing ties visible, and recommendations that leave out anyone already in Connections.

**Marketing website (`apps/landing`).** A standalone Next.js 16 site: home, features, how it
works, AI persona, compatibility, safety, about, contact, and draft privacy and terms. Real app
screenshots (`docs/design-reference`), real engine output, full technical SEO (metadata,
canonicals, hreflang, sitemap, robots, JSON-LD) driven by one route registry, consent-gated
GA4, and an automated audit (`docs/seo/seo-audit-report.md`: 508/508 checks, Lighthouse 100 in
the lab). Not deployed: there is no production domain, contact address or reviewed legal text
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

**New — chat features, phase A.** In a conversation you can long-press a message to react
(six emoji, one each), reply with a quote, pin it for both of you (up to three, shown in a bar
at the top), edit your own text for 15 minutes ("Edited"), forward your own text to up to five
other conversations, or remove/report as before. "Send later" schedules a message up to a week
ahead and lists what's waiting, with cancel. Conversation settings add a shared theme (five
design-system presets; both see it, either can change it, with a note in the chat) and Restrict. You → Notifications can hide who a notification is from;
You → Message privacy sets read-receipt and typing defaults for new conversations. Phases B–E
(ephemeral media and video, device protection, relationship tools, abuse rules) are next.

**New — chat features, phase B.** Video messages up to 30 s (transcoded to ≤ 720p H.264 in the
worker, poster frame, five frames checked by the classifier). Before a photo or video goes,
the sender can choose view once, a timer after opening (10 s – 24 h), sensitive (blurred until
tapped) and whether it can be saved. View-once and timed media arrive blurred and open in a
full-screen viewer; view-once is erased when closed and shows "Opened". Text can self-destruct
after it is read. Either person can turn on disappearing messages (24 h / 7 d / 90 d) with a
note for both. New conversations ask before showing the other person's media. Protected media
carries the recipient's name as a watermark. Photos and videos can be kept in a private vault
(You → Your vault). You → Message privacy adds the media, blur and disappearing defaults.
Device-only parts (native video playback, the iOS/Android pickers) are unverified on hardware.
Also fixed on the way: bottom sheets now scroll when taller than the screen.

## What is deliberately not there

- **Sign-in codes are not delivered.** The development sender returns the code to the app,
  which shows it on screen. Production refuses to start in this mode.
- **Photos are stored on local disk.** Production refuses to start in this mode.
- **Terms of Service and Privacy Policy documents do not exist**; the consent screen has
  nothing to link to.
- **Push on real devices** is unverified: it needs a development or store build linked to an
  EAS project. The web build and Expo Go skip registration.
- **Voice notes are not automatically moderated** (no audio classifier); they rely on reports.
- No archive import, admin console (moderation is API-only), or request expiry job.

## Verification (run 15 Nov 2026 in the cloud container)

| Check                             | Result                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`, `pnpm lint`  | Pass                                                                                                                                                                                                                                  |
| `pnpm build`, `pnpm typecheck`    | Pass (5 packages)                                                                                                                                                                                                                     |
| `pnpm test`                       | Pass — validation 46, design-system, compatibility-engine, api 59 (incl. the real nsfwjs model, audio sniffing, Wingman prompt and filter), mobile 4                                                                                  |
| `pnpm test:e2e`                   | Pass — 222 tests in 15 suites against real PostgreSQL, Redis, the queue, ffmpeg and the Rust gateway (new: chat phase A 9, shared theme, `ephemeral` 11 incl. real video transcoding, range requests, watermark pixel check, sweeper) |
| `prisma migrate diff --exit-code` | Pass — no drift, 13 migrations                                                                                                                                                                                                        |
| `expo export --platform web`      | Pass                                                                                                                                                                                                                                  |
| `pnpm e2e:web`                    | Pass — 55 screenshots, no browser errors: chat actions, send later, media send options, held media and allowing it, view-once open and close, vault, shared theme and disappearing-messages notes                                     |
| `pnpm rust:check`                 | Pass — fmt, clippy `-D warnings`, 13 Rust tests (engine 8 incl. learning 6, parity 2 over 2 000 pairs + 60 rankings, gateway 3)                                                                                                       |
| Benchmarks                        | `scripts/bench-engine.mjs`, `cargo bench -p vyra-engine`, `scripts/bench-realtime.mjs` — numbers above                                                                                                                                |

Found and fixed while verifying Milestone 7: the addon was first _slower_ than TypeScript
because whole result sets crossed the boundary twice (fixed with a single `recommend` call);
the gateway used 135 KB per connection until its socket buffers were sized for tiny frames;
your own sent message could clear the other person's "typing…" (events now carry the actor);
the gateway's log filter collided with the API's `LOG_LEVEL` (now `RUST_LOG`); closing a
flooding socket could reset the connection before the client saw why (it now drains first);
AVIF at the default encoder effort took ~1.8 s per photo (effort 0 is used).

Found and fixed while verifying Milestone 6: the global HTTP auth guard crashed on socket
messages (it now recognises socket contexts, which are authenticated at connect); live
"list changed" events re-fetched a just-blocked person's profile (only on-screen queries
refetch now, and blocking stops those queries first); lists kept on screen for over ten
minutes showed expired signed photo URLs (media-bearing queries now refresh every five).

Found and fixed while verifying Milestone 5: Orbit drew people on top of each other when one
alignment band was crowded (now spills outward and starts zoomed to fit; unit-tested); the
shared `Button` ignored a custom accessible name, so Discover's Pass/Save didn't say whose
card they were on; blocking re-fetched the blocked person's profile (a 404) while leaving it.

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
- `pnpm e2e:web` creates several people through the API and waits out the five-codes-a-minute
  limit when it hits it, so a run takes a few minutes. Start the API from `apps/api` so it
  reads `apps/api/.env`.
- Orbit and Discover share one recommendations query (fresh for 3 minutes); someone who
  becomes eligible in that window appears on the next refresh.
- On a phone, panning the Orbit canvas vertically competes with scrolling the screen; the
  zoom and re-centre buttons always work.
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

Run the gateway alongside the API for live updates: `pnpm dev:realtime`. Then continue
Milestone 7 (`docs/IMPLEMENTATION_BACKLOG.md`): AI archive import.

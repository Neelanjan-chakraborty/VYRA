# Decisions

Newest last. Each entry: what was decided, why, and what would make us revisit it.

## Made

**D-001 · pnpm + Turborepo monorepo with two apps and two packages.**
Shared schemas and tokens need exactly one home. Packages exist only where two consumers or
purity demand it; `shared-types`, `ai-schemas` and `config` from the suggested layout are
folded into `validation` (types are inferred from schemas) and a root `tsconfig.base.json`.
`compatibility-engine` and `apps/admin` are created when their milestones start.

**D-002 · TypeScript 6.0.x, not 7.** Expo SDK 58, the Nest CLI and `@nestjs/swagger` do not
support 7 yet. Revisit when all three do.

**D-003 · Prisma 7.10.1 pinned exactly, not the 8.0 release candidate** that npm tags `latest`.
Revisit on a stable 8.0.

**D-004 · NestJS 12, ESM, Express adapter, Vitest.** Template defaults. Express over the faster
`platform-node` adapter because Socket.IO and `helmet` are proven on it; revisit if request
throughput becomes the bottleneck.

**D-005 · Zod everywhere via Standard Schema; no `class-validator`, no `nestjs-zod`.** One
schema language shared with the client. `nestjs-zod` does not support Nest 12 and Nest 12
validates Standard Schema natively.

**D-006 · Embeddings live in a `vyra_vector` PostgreSQL schema outside Prisma.** Prisma cannot
model a pgvector HNSW index and tries to drop it as drift. Cost: raw SQL for that one table.

**D-007 · Embedding dimension 768.** Both planned providers can emit 768-dimensional vectors,
and it halves storage and index cost against 1536. Changing it requires re-embedding.

**D-008 · Configuration is a single Zod-parsed object; no `@nestjs/config`.** Less machinery,
same guarantee: the process will not start misconfigured.

**D-009 · Built-in Nest JSON logger; no pino.** Structured logs without a dependency. Revisit
if we need redaction rules or transports.

**D-010 · oxlint + Prettier for the whole repo.** One fast linter for API and React code; it is
what the Nest 12 template ships. Warnings fail CI.

**D-011 · Headless `expo-router/ui` tabs with our own tab bar and icon set.** The bar is brand
surface; platform-default tab bars and stock icon packs would look generic.

**D-012 · Dark theme only at launch.** The identity is dark; a light theme is a second design,
not a colour swap. Tokens are semantic, so adding one later does not touch screens.

**D-013 · Instrument Serif (display) + Manrope (interface),** bundled through
`@expo-google-fonts` (SIL Open Font License).

**D-014 · Symmetric pairs stored once with `a < b`.** One row per pair for matches and scores,
enforced by CHECK constraints.

**D-015 · Compatibility cache keyed by persona version ids.** Invalidation by construction
instead of by bookkeeping.

**D-016 · Shared packages are consumed as built `dist/` output.** Works identically in Node
(ESM) and Metro. Cost: `pnpm build` after editing a package. Revisit if it slows mobile work.

**D-017 · The Expo web export is the automated visual check.** No simulator or emulator exists
in the cloud environment. It is a proxy; native behaviour still needs device testing.

**D-018 · Cloud dev environment uses the container's own PostgreSQL and Redis;** Docker Compose
is for workstations. Both use the same throwaway `vyra`/`vyra` dev credentials.

**D-019 · Registration is a separate step after OTP verification.** Verifying a new
destination returns a 15-minute registration token; the account is created only when a date
of birth (18+) and consent arrive with it. No row exists for anyone who is refused or abandons.

**D-020 · OTP challenges store only an HMAC of the destination,** so the client re-sends the
destination when verifying. A leaked challenges table reveals no contact details or codes.

**D-021 · Sessions are checked in the database on every authenticated request.** One indexed
lookup buys immediate logout, suspension, deletion and reuse-revocation. Revisit with a Redis
cache if it shows up in latency.

**D-022 · Development OTP sender returns the code in the API response** and sends nothing
(O-1 default). Configuration validation refuses it, and local-disk storage (O-2 default), in
production — so production cannot start with a stand-in by accident.

**D-023 · Account deletion purges personal data immediately and keeps an anonymous tombstone
row,** so a reported or banned person cannot erase their safety history by deleting.

**D-024 · Onboarding collects identity, photos, interests (optional), intention and
preferences.** The AI import and persona-review stages are left out of the flow until they
work (Milestones 3 and 7) instead of being shown as placeholders.

**D-025 · One component per profile step serves both onboarding and Settings,** differing only
in chrome (`useStepChrome`). No duplicated forms.

**D-026 · Navigation is gated in one place** (`useAppPhase` + `Stack.Protected` in the root
layout): signed out → auth, onboarding → setup, active → app.

**D-027 · Mobile UI is verified by a browser run of the whole account lifecycle**
(`pnpm e2e:web`) against the real API, replacing the tab-only screenshot script. Component
tests with `jest-expo` are deferred; see the backlog.

**D-028 · Provider output is typed `unknown` and filtered, never repaired.** An attribute
survives only if it is in the catalogue, has a valid value and cites material the person
actually gave. Unusable output is retried once and then fails with a code.

**D-029 · Calibration is deterministic code, not the model's own confidence.** Caps by
evidence type; disagreement halves confidence and asks the person.

**D-030 · "Ask your AI" is a copy-and-paste questionnaire, not an integration.** No assistant
offers an API to read a person's history. The person copies VYRA's questions into their own
assistant and pastes the answer back. VYRA parses the answer as JSON and never sends it to a
model, which makes prompt injection through it inert. Requested by the product owner during
Milestone 3.

**D-031 · Scales are asked as 1–5 and stored as 0–1,** edited as a five-step control. They
describe tendencies, not measurements, so a continuous slider would imply false precision.

**D-032 · Generation runs on BullMQ inside the API process by default.** `src/worker.ts`
and `RUN_QUEUE_WORKERS=false` split it out without code changes when load requires it.

**D-033 · Default Gemini models: `gemini-3.8-flash` and `gemini-embedding-001`** (both
configurable). The embedding model is the stable one; `gemini-embedding-2` was preview-only
when checked (14 Nov 2026).

**D-034 · The compatibility engine is a separate pure package** (`@vyra/compatibility-engine`)
so it can be tested exhaustively with synthetic people and reused by workers without Nest or
Prisma.

**D-035 · Sparse data is pulled towards neutral:** `overall = 0.5 + (raw − 0.5) ·
dataCoverage`, and no number below 40 % weighted coverage. Agreement on a few known traits must
not look like a strong match.

**D-036 · ~~Unknown gender matches no gender filter.~~ Superseded by D-042.** People with a gender VYRA cannot
categorise are shown only to those with no gender filter. Guessing would be worse. Revisit
with an explicit category choice in the profile.

**D-037 · Serious ↔ casual is a hard gate; other intention differences are scored.**

**D-038 · "Financial attitudes" is presented as "Priorities and planning"** and uses only
planning style and stated values. VYRA holds no financial information and will not infer it.

**D-039 · Scores are recomputed per request; the cache table is a record, not a read path.**
Scoring a pair takes microseconds; caching would add invalidation risk for no gain yet.

**D-040 · Photos appear on other people's screens only once approved by moderation.** (Moderation now exists — D-041.) Until
moderation exists (Milestone 5) recommendations carry no photo.

**D-041 · Photo moderation uses nsfwjs (MIT), offline, behind a provider interface.** The
product owner asked for a free, open-source service. nsfwjs bundles its MobileNetV2 model, runs
on pure-JS TensorFlow in the queue worker (~1–2 s per photo) and needs no credentials, so it is
verified here, not just written. Rules: explicit ≥ 0.85 reject; explicit ≥ 0.4 or suggestive
≥ 0.7 to a person; classifier failure to a person; otherwise approve. `manual` sends everything
to a person; `mock` is test-only and refused in production. Its blind spots (violence, minors,
identity) are covered by reports and human review.

**D-042 · Structured gender identity; unlisted identities included by default.** Five options
plus unanswered; self-describers can choose which searches to appear in; a viewer who picks
specific identities still sees self-described, undisclosed and unanswered people unless they
turn that off. Private unless shown. Never inferred.

**D-043 · Media URLs carry a signed scope and are re-checked on every request.** Revoking a
photo must take effect immediately, including for URLs already handed out.

**D-044 · Photos are hidden after two distinct reporters** (product owner's choice), not one.

**D-045 · Location is stored on a 0.02° grid (~2 km).** Coarse enough not to pinpoint anyone,
fine enough for a 10 km radius. Manual choices use GeoNames place centres (CC BY 4.0,
generated by `scripts/build-places.mjs`, 539 Indian places ≥ 100k people); an unlisted city is
kept as a label without coordinates rather than guessed. No external geocoding service.

**D-046 · A missing location never excludes anyone.** Distance applies only when both people
have one; the API reports whether the viewer's own filter is active.

**D-047 · Criteria have three modes, and only "must" filters.** Must-haves exclude only on
known values; preferences are a soft signal in _Mutual preferences_; engine version `compat-2`.
Impact is reported in buckets so it cannot identify anyone.

**D-048 · A first Discover list ships before Milestone 5** (product owner's choice) so photo
safety, distance and must-have notices can be verified end to end. Connect, save, pass and
Orbit remain Milestone 5.

**D-049 · Existing ties keep people visible.** A pending request or mutual connection keeps both
people viewable to each other even if one later changes preferences or hides from discovery;
blocks, deletion and suspension always win. One rule (`PeopleService.visiblePair`) serves every
non-owner endpoint.

**D-050 · Pass hides for 30 days; a decline blocks re-asking for 30 days; at most 20 pending
requests.** Gentle limits against pressure and spam without permanent judgements. A withdrawn
request can be re-sent at once. Mutual requests become a connection immediately.

**D-051 · No engagement counters.** No unread badges on tabs, no "X people liked you", and
reciprocal interest is not a ranking signal. Connections lists what is waiting, calmly.

**D-053 · Socket events carry ids, never content.** Clients refetch over HTTP, so every read
passes the one access rule and nothing private travels over the socket or into push payloads.

**D-054 · A conversation is hidden from both people across a block, read-only after a
connection ends.** History is kept for both until account deletion; messages remain in the
database for reports.

**D-055 · Read receipts are reciprocal.** Turning them off also hides the other person's.
Typing is shared by default and can be turned off per conversation.

**D-056 · Private photos are not delivered when the classifier is unsure.** Unlike profile
photos, message photos never go to human review unless someone reports them; the sender is
told and can send another.

**D-057 · Voice notes have no automated moderation** (product owner's choice to include them).
They are limited to 60 s and 2 MB, sniffed by content, and reportable per message; a report
hides the note from the reporter at once.

**D-058 · Push says who, never what.** "New message from Asha"; nothing while the app is open,
for muted conversations, turned-off types, or across a block. Expo push service behind a
provider switch (`PUSH_PROVIDER=log|expo`).

**D-059 · Wingman sees profiles by default, messages only with a per-conversation switch plus
consent; it never sends.** The recipient is not shown that a message started as a suggestion
(it is the sender's after editing); `aiAssisted` is stored for safety review.

**D-052 · Orbit places people by estimated alignment, angle by a hash of their id.** Rings are
alignment bands (insufficient data on a dashed outer ring); the angle carries no meaning and is
stable between visits. Pure function, unit-tested; pan/pinch plus Zoom and Re-centre buttons;
reduced motion skips animation.

**D-060 · Hybrid NestJS + Rust** (product owner's choice). Nest keeps business logic; Rust runs
the matchmaking core in-process (napi-rs, no network hop) and the realtime gateway as its own
process. LLM calls stay in Nest (network-bound). The TypeScript engine is kept as the
reference: Rust must match it exactly (parity fixtures + live comparison), and production
refuses to start without the Rust addon.

**D-061 · One call per recommendation step.** Crossing the JS↔Rust boundary costs more than
scoring one pair, so `recommend()` gates, scores, ranks and explains in Rust and returns only
the top results. Single-pair calls still go through Rust (one implementation) at ~40 µs extra.
Speed claims are only made from measured benchmarks (`scripts/bench-engine.mjs`).

**D-062 · Learned weights are proposals, never applied automatically.** Guardrails: dimensions
only, each weight 0.05–0.40, ±0.05 per proposal, held-out AUC must improve, minimum sample
sizes; an admin approves, and the database allows one active, approved set.

**D-063 · Realtime: Rust gateway, plain WebSocket + MessagePack, Nest still writes messages**
(product owner's choice). Access rules stay in one place; the gateway only authenticates,
delivers id-only events from Redis, tracks presence and relays typing after a read-only check
mirroring the API's rule. Socket.IO removed.

**D-064 · Compression where it pays:** AVIF + thumbnails for photos, speech Opus 24 kbps (+ a
CAF copy for iOS) for voice, brotli for JSON, MessagePack for socket frames, client-side resize
before upload. No per-message text codec (messages are small; TOAST covers large values).
AVIF uses encoder effort 0: ~60 % smaller than JPEG at the same encode time; higher effort
took seconds per upload.

**D-065 · Media caching follows who is looking.** Owner URLs: `max-age=600, immutable`; other
people's: 60 s, so moderation, blocks and reports reach their devices within a minute.

**D-066 · Chat additions stay server-enforced and small** (chat features, phase A). Reactions
come from a fixed set of six, one per person per message. Pins are shared and capped at three.
Edits are allowed for 15 minutes and keep no history — the message just says "Edited".
Forwarding is limited to your own text: someone else's words and every photo or voice note stay
in the conversation they were sent to. Scheduled messages are BullMQ delayed jobs keyed by the
schedule id (which is also the message's `clientId`, so a retried job never sends twice), sent
only while the connection is still open. Themes are design-system presets (see D-069).

**D-067 · Restrict is quiet, one-sided and reversible.** The restricted person still sees the
conversation, but gets no pushes from you and never sees your read receipts or typing (the
gateway checks the same flag). They aren't told. Restriction is the gentler step before blocking.

**D-068 · Privacy defaults are copied, not linked.** New conversations take the person's
read-receipt and typing defaults when they open. Changing a default doesn't touch existing
conversations, so earlier choices made in a conversation are never overridden. "Hidden"
notification previews leave out the sender's name as well as the content.

**D-069 · The chat theme is shared** (product owner's request, replacing per-person themes).
It lives on the conversation; either person can change it while the connection is open, and a
system line ("Asha changed the theme to Dusk") tells both. Re-choosing the current theme adds no
line. Per-person choices from before were cosmetic and were not carried over.

**D-070 · Ephemeral media is enforced by the server, honestly labelled.** View once: the
recipient sees only a blurred preview until they open it; "open" returns one-minute URLs once,
and closing (or a deadline a minute or so later) erases the files. Timers start at first open
(media) or first read (text). Disappearing messages are shared per conversation, either person
sets them, both see a note; new conversations take the shorter of the two people's defaults.
Every expiry is one `expires_at`: nothing past it is returned or served, and a minute-by-minute
sweeper erases it. The app says plainly that a screen can still be photographed.

**D-071 · Watermark protected media only** (product owner's choice). View-once, timed and
sensitive photos and videos get the recipient's first name and the date tiled faintly into the
pixels. Chats are one-to-one, so the mark is burned in once at processing time and both people
see the same file — no per-request rendering. Ordinary photos stay clean.

**D-072 · Ask before showing media** (product owner's choice). New conversations hold the other
person's photos, videos and voice notes — no URLs at all — until the recipient allows media from
them; the default can be changed to "allow". Existing conversations were set to allowed. The
sender always sees their own media, with a note that it's waiting.

**D-073 · Video is processed off the request path.** The upload is checked by its bytes and
stored; a worker transcodes it (H.264/AAC, ≤ 720p, faststart), makes a poster and a blurred
preview, and runs 5 frames through the same classifier as photos — all must pass. The other
person sees nothing until then.

**D-074 · The vault holds copies, not links.** Saving copies the files under the owner's own
prefix, so they survive removal of the message and are deleted with the account. Never for
view-once or timed media, and only where the sender allowed saving. Photos and videos only.

**D-075 · Signed media URLs are stable for a few minutes.** Expiry is rounded up to a five-minute
boundary, so re-signing after a refetch gives the same URL and image caches hit instead of
downloading again (found in the browser run: every chat event reloaded every image).

## Open (need the product owner)

| #   | Question                                               | Needed by     | Default if unanswered                                                    |
| --- | ------------------------------------------------------ | ------------- | ------------------------------------------------------------------------ |
| O-1 | SMS and e-mail OTP vendors                             | Milestone 2   | Interface + local fake that logs nothing sensitive; no real sends        |
| O-2 | Object-storage vendor                                  | Milestone 2   | S3-compatible interface + local disk adapter for development             |
| O-3 | LLM provider for persona generation                    | Milestone 3   | Gemini (a key was planned); mock in tests                                |
| O-4 | Hosting provider and region                            | Milestone 8   | Undecided                                                                |
| O-5 | Payment provider and plans                             | Milestone 8   | Store billing interfaces only                                            |
| O-6 | Legal review of age verification and DPDP obligations  | Before launch | Date-of-birth self-declaration only                                      |
| O-7 | Website production domain, contact address, legal text | Before launch | Site stays a non-indexable preview; legal and contact pages stay noindex |

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

**D-036 · Unknown gender matches no gender filter.** People with a gender VYRA cannot
categorise are shown only to those with no gender filter. Guessing would be worse. Revisit
with an explicit category choice in the profile.

**D-037 · Serious ↔ casual is a hard gate; other intention differences are scored.**

**D-038 · "Financial attitudes" is presented as "Priorities and planning"** and uses only
planning style and stated values. VYRA holds no financial information and will not infer it.

**D-039 · Scores are recomputed per request; the cache table is a record, not a read path.**
Scoring a pair takes microseconds; caching would add invalidation risk for no gain yet.

**D-040 · Photos appear on other people's screens only once approved by moderation.** Until
moderation exists (Milestone 5) recommendations carry no photo.

**D-041 · The marketing website is a separate Next.js app, `apps/landing`,** not an Expo web
screen. It has no runtime dependency on the API or on workspace packages, so it deploys on its
own. Shared tokens are copied in by a script (`pnpm --filter @vyra/landing tokens`). Its accent
is cherry and oxblood where the app's is violet: requested by the product owner for the site;
the app is unchanged, and app screenshots on the site are shown with their violet as it is.

**D-042 · The website shows only real product visuals.** Screens are captured from the app with
a synthetic account; screens that are empty states are shown empty. Compatibility has no screen
yet, so the site prints the engine's actual output for two invented profiles instead of a
mock-up. Every capability is labelled built, engine built, in development or planned.

**D-043 · The website has no hard-coded domain, contact address or legal text.** Canonical
URLs come from `NEXT_PUBLIC_SITE_URL` (a production build fails without it); only a deployment
marked production is indexable. `/privacy` and `/terms` are clearly marked drafts and `/contact`
has no address, so all three are noindex until the real details are supplied.

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

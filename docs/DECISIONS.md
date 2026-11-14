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

## Open (need the product owner)

| #   | Question                                              | Needed by     | Default if unanswered                                             |
| --- | ----------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| O-1 | SMS and e-mail OTP vendors                            | Milestone 2   | Interface + local fake that logs nothing sensitive; no real sends |
| O-2 | Object-storage vendor                                 | Milestone 2   | S3-compatible interface + local disk adapter for development      |
| O-3 | LLM provider for persona generation                   | Milestone 3   | Gemini (a key was planned); mock in tests                         |
| O-4 | Hosting provider and region                           | Milestone 8   | Undecided                                                         |
| O-5 | Payment provider and plans                            | Milestone 8   | Store billing interfaces only                                     |
| O-6 | Legal review of age verification and DPDP obligations | Before launch | Date-of-birth self-declaration only                               |

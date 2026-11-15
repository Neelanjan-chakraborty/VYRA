# System architecture

## Shape

A hybrid: **NestJS owns business logic; Rust owns the hot paths.** The NestJS API (one
codebase, optionally split into API and worker processes) handles auth, access rules,
moderation, persistence, push and AI-provider calls. Two Rust components do the work where
speed and memory matter:

- **Matchmaking core** (`crates/vyra-engine`), loaded _inside_ the API process as a napi-rs
  addon (`@vyra/engine-native`): gates, scoring, ranking, explanations and weight learning.
  No network hop. The TypeScript engine stays as the reference implementation; parity tests
  prove both give identical results.
- **Realtime gateway** (`crates/vyra-realtime`), a separate axum/tokio process: every app
  socket, presence and typing. It never writes messages.

```
 Expo app (iOS / Android / web)                       Admin console (later)
   │ HTTPS /v1 (JSON, brotli)    │ WebSocket /v1/realtime (MessagePack)
   ▼                             ▼
 ┌──────────── apps/api (NestJS) ─────────┐   ┌──── vyra-realtime (Rust) ────┐
 │ auth · access rules · moderation       │   │ token + session check        │
 │ messaging writes · push · AI providers │   │ sockets, presence, typing    │
 │ ┌───────────────────────────────────┐ │   │ delivers id-only events       │
 │ │ vyra-engine (Rust, in-process)     │ │   └───────▲──────────────┬───────┘
 │ │ gates · score · rank · learning    │ │           │ subscribe    │ read-only SQL
 │ └───────────────────────────────────┘ │──publish──┘ (Redis)      │ (sessions,
 └──────┬───────────────┬────────────────┘                          │  typing rule)
        ▼               ▼                                           ▼
   PostgreSQL 16     Redis 7: cache, rate limits, queues,      PostgreSQL
   + pgvector        pub/sub fan-out, presence
```

(The original single-process picture, kept for module boundaries:)

```

Expo app (iOS / Android / web) Admin console (later)
│ HTTPS /v1, WebSocket │
▼ ▼
┌──────────────────────── apps/api ────────────────────────┐
│ HTTP edge: request id → helmet → CORS → throttler │
│ → validation (Zod) → guards → controllers │
│ Modules: auth · users · profiles · photos · persona │
│ ai-providers · imports · compatibility │
│ matching · discovery · connections · messaging│
│ trends · astrology · subscriptions │
│ notifications · safety · analytics · admin │
│ Platform: config · database (Prisma) · redis · queue │
└───────┬───────────────┬──────────────────┬───────────────┘
▼ ▼ ▼
PostgreSQL 16 Redis 7 Object storage (S3 API)

- pgvector cache, rate photos, import archives
  limits, queues, (private, signed URLs)
  socket fan-out

```

## Packages

| Package                                    | Responsibility                                | Used by               |
| ------------------------------------------ | --------------------------------------------- | --------------------- |
| `@vyra/validation`                         | Zod schemas, inferred types, domain constants | api, mobile           |
| `@vyra/design-system`                      | Design tokens, contrast helper                | mobile                |
| `@vyra/compatibility-engine` (Milestone 4) | TypeScript reference engine; parity source    | api (fallback), tests |
| `@vyra/engine-native` (Milestone 7)        | The Rust engine as an in-process addon        | api                   |

Rust crates (`Cargo.toml` workspace): `vyra-engine` (pure engine + learning),
`vyra-engine-node` (N-API bindings), `vyra-realtime` (gateway binary).

A package is created only when two consumers need the code or when purity matters (the
scoring engine must be testable with no framework or database).

## Module rules

- A module owns its tables. Other modules call its exported service, never its tables.
- Controllers are thin: validate, authorise, delegate. Business rules live in services.
- Cross-module side effects go through domain events (in-process emitter first, queue when the
  work is slow or must survive a restart).
- Anything slow or risky — archive parsing, LLM calls, embedding, batch scoring — runs in a
  worker, never in a request.

## Request lifecycle

1. `requestIdMiddleware` assigns or validates `x-request-id`.
2. `helmet` security headers; CORS from the `CORS_ORIGINS` allow-list (empty = no browsers).
3. `ThrottlerGuard`: 120 requests/minute per IP baseline; stricter per-route limits on OTP,
   uploads and AI endpoints.
4. Zod validation of body, params and query.
5. Auth guard (JWT access token) and ownership/role checks.
6. Handler. Errors of any kind pass through `ApiExceptionFilter`, which emits
   `{ error: { code, message, details?, requestId } }` and never leaks internals.

API versioning is in the URI (`/v1/...`).

## AI architecture (Milestones 3 and 7)

- `AiProvider` interface with `mock`, `gemini` and `openai` implementations, selected by
  `AI_PROVIDER`. The mock is deterministic and is the only provider used in tests.
- LLMs produce **structured persona drafts** only, validated against a Zod schema. They never
  compute compatibility.
- Imported content is untrusted: it is passed as data inside delimited blocks, never as
  instructions, after secret and sensitive-data redaction, and only the minimum needed.
- Compatibility is a deterministic, versioned function of two approved persona versions and a
  versioned weight set. Results are cached in `compatibility_scores`, keyed by both persona
  version ids so a new persona version naturally invalidates them.

## Realtime

The Rust gateway (`crates/vyra-realtime`) holds every app connection: WebSocket at
`/v1/realtime`, MessagePack frames, authenticated by the first frame with the same access token
and session check as the API. The API publishes id-only events (`conversation.changed`,
`list.changed`, disconnects) on Redis channel `<namespace>:realtime`; every gateway instance
subscribes and delivers to its own sockets, so instances scale horizontally with no sticky
sessions. Presence lives in Redis (`<namespace>:presence:<user>`, TTL refreshed by heartbeat)
and suppresses push for people who have the app open. Typing is checked against the same rule
as the API (participant, active connection, no block, `shares_typing`) with one read-only
query. All writes — messages, receipts, settings — stay HTTP in Nest, so access rules live in
one place.

Measured locally (single machine, see `scripts/bench-realtime.mjs`): publish → socket p50
4 ms, p99 12 ms over 100 000 deliveries to 500 connections; ~10–13 KB of gateway memory per
connection (7 MB idle). At 2 000 connections the single-threaded Node test client, not the
gateway, becomes the bottleneck.

## Compression

| What                          | How                                                                                                                                              | Measured / bounded                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Photos (profile and messages) | AVIF, max 1600 px, plus a 320 px AVIF thumbnail for lists, cards, avatars and bubbles                                                            | ~60 % smaller than JPEG q86 at the same ~0.2 s encode (1600 px) |
| Uploads                       | App resizes to ≤ 1600 px JPEG q0.82 before sending; voice recorded mono 64 kbps (32 kbps WebM in browsers)                                       | —                                                               |
| Voice notes                   | Server re-encodes to Ogg Opus 24 kbps mono, speech mode; a CAF copy (no re-encode) for iOS's native player; duration measured by ffprobe         | ≤ ~180 KB per minute; e2e asserts < ⅓ of a 128 kbps upload      |
| API JSON                      | brotli (gzip fallback) for responses ≥ 1 KB                                                                                                      | —                                                               |
| Socket frames                 | MessagePack, ids only                                                                                                                            | smaller than the same JSON (unit-tested)                        |
| Media caching                 | Signed URLs are immutable for 10 min: owner copies cached for all of it; other people's for 60 s so moderation, blocks and reports apply quickly | —                                                               |

Text messages are not compressed individually: at under 2 KB a per-message codec saves little
and costs CPU; Postgres TOAST already compresses large values.

## Engine performance (measured)

`node scripts/bench-engine.mjs` (Node 22, through the addon including JSON in and out):
recommendations over a 200-candidate pool (gate both ways, score, rank with diversity, explain
the top 30) ≈ 1.5–1.8× faster than the TypeScript engine; the Rust compute alone is ~1 ms
(`cargo bench -p vyra-engine`: 5.8 µs per pair). A single-pair call is ~40 µs slower than
TypeScript because of the language boundary — negligible beside the database work on those
requests. LLM calls stay in Nest: they are network-bound and Rust would not make them faster.

## Environments and configuration

All configuration is environment variables parsed once by `src/config/env.ts`. A missing or
malformed value stops the process at boot with the variable name and reason, never the value.

## Observability

Structured JSON logs in production with request ids; `/v1/health/live` and `/v1/health`
probes. Sentry (errors) and PostHog (privacy-aware product analytics) are planned behind
interfaces and are not connected yet.

# System architecture

## Shape

A modular monolith. One NestJS process serves HTTP and WebSockets; a second process type (same
codebase) will run BullMQ workers for imports, persona generation and scoring. No microservices
until a module has a scaling or isolation need that a worker cannot meet.

```
 Expo app (iOS / Android / web)          Admin console (later)
            │  HTTPS /v1, WebSocket               │
            ▼                                     ▼
 ┌──────────────────────── apps/api ────────────────────────┐
 │  HTTP edge: request id → helmet → CORS → throttler        │
 │             → validation (Zod) → guards → controllers     │
 │  Modules:   auth · users · profiles · photos · persona    │
 │             ai-providers · imports · compatibility        │
 │             matching · discovery · connections · messaging│
 │             trends · astrology · subscriptions            │
 │             notifications · safety · analytics · admin    │
 │  Platform:  config · database (Prisma) · redis · queue    │
 └───────┬───────────────┬──────────────────┬───────────────┘
         ▼               ▼                  ▼
   PostgreSQL 16     Redis 7          Object storage (S3 API)
   + pgvector        cache, rate      photos, import archives
                     limits, queues,  (private, signed URLs)
                     socket fan-out
```

## Packages

| Package                                    | Responsibility                                | Used by     |
| ------------------------------------------ | --------------------------------------------- | ----------- |
| `@vyra/validation`                         | Zod schemas, inferred types, domain constants | api, mobile |
| `@vyra/design-system`                      | Design tokens, contrast helper                | mobile      |
| `@vyra/compatibility-engine` (Milestone 4) | Pure, dependency-free scoring functions       | api         |

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

Socket.IO gateway inside the API process with the Redis adapter for multi-instance fan-out.
Message writes go through HTTP or socket handlers that share one service; the socket layer
carries delivery, typing and read state.

## Environments and configuration

All configuration is environment variables parsed once by `src/config/env.ts`. A missing or
malformed value stops the process at boot with the variable name and reason, never the value.

## Observability

Structured JSON logs in production with request ids; `/v1/health/live` and `/v1/health`
probes. Sentry (errors) and PostHog (privacy-aware product analytics) are planned behind
interfaces and are not connected yet.

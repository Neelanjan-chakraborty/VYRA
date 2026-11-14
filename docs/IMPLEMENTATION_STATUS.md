# Implementation status

Last updated: 14 November 2026, end of the first implementation cycle.

## Summary

| Milestone                     | Status                                            |
| ----------------------------- | ------------------------------------------------- |
| 0 — Audit and plan            | Done                                              |
| 1 — Foundation                | Done                                              |
| 2 — Design and authentication | Not started                                       |
| 3 — AI Persona                | Not started (schema tables and design doc only)   |
| 4 — Compatibility             | Not started (weights, tables and design doc only) |
| 5–8                           | Not started                                       |

## What works today

- **Monorepo**: pnpm workspace, Turborepo task graph, strict TypeScript, oxlint, Prettier.
- **API** (`apps/api`): boots against PostgreSQL and Redis; refuses to boot when
  misconfigured; `/v1/health` and `/v1/health/live`; URI versioning; security headers; CORS
  allow-list; rate limiting; request ids; uniform error envelope; OpenAPI at `/docs`.
- **Database**: 32 tables across identity, profile, persona, compatibility, discovery,
  messaging, safety and audit; 34 CHECK constraints; partial unique indexes; pgvector table
  with an HNSW index; initial weight set seeded. One migration, applied, no drift.
- **Shared packages**: API contracts and domain constants (`@vyra/validation`); design tokens
  with enforced WCAG AA contrast (`@vyra/design-system`).
- **Mobile** (`apps/mobile`): Expo SDK 58 app with the five-destination navigation, custom tab
  bar and icons, brand fonts, app icons, validated API client, TanStack Query. In development
  builds the You tab shows live API/database/Redis connectivity.
- **CI**: GitHub Actions workflow running the full check suite with service containers.

## What is deliberately not there

The five tab screens are **empty states, not features**. There is no authentication, no user
data endpoint, no persona generation, no compatibility scoring, no discovery, no messaging.
`apps/admin` and `packages/compatibility-engine` do not exist yet.

## Verification (run 14 Nov 2026 in the cloud container)

| Check                                  | Result                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm format:check`                    | Pass                                                                                   |
| `pnpm lint` (warnings are errors)      | Pass                                                                                   |
| `pnpm build`                           | Pass (3 packages)                                                                      |
| `pnpm typecheck`                       | Pass (4 packages incl. mobile)                                                         |
| `pnpm test`                            | Pass — 25 tests (validation 4, design-system 11, api 10)                               |
| `pnpm test:e2e`                        | Pass — 7 tests against real PostgreSQL and Redis                                       |
| `prisma migrate diff --exit-code`      | Pass — no drift                                                                        |
| API booted and called with `curl`      | Pass — health 200, unknown route → error envelope, boot refused without `DATABASE_URL` |
| `expo export --platform web`           | Pass                                                                                   |
| `pnpm visual-check`                    | Pass — 15 screenshots (5 tabs × 320/390/820pt), no console errors, no overflow         |
| Service-status panel (Expo dev server) | Pass — "Connected" ×3 with API up, "Unavailable" ×3 with API stopped                   |

Not verified: iOS and Android native builds (no simulator or emulator in this environment),
the GitHub Actions workflow itself (it has not run yet), Docker Compose (services were run
natively in the container), screen-reader behaviour on a device.

## Known issues and caveats

- The CI workflow is untested until the first push to a PR or `main`.
- pgvector in the cloud container is 0.6.0 (Ubuntu package); the Compose image may be newer.
  Only features present in 0.6 are used.
- `@scarf/scarf` (a transitive telemetry install script) is blocked by pnpm; nothing depends
  on it running.
- A Gemini API key is not configured in the environment. Not needed until Milestone 3.

## Resume here

```bash
pnpm services:start
pnpm install
pnpm db:deploy
pnpm build
pnpm check && pnpm test:e2e
```

Then start Milestone 2 at item 1 of `docs/IMPLEMENTATION_BACKLOG.md` (the `auth` module).
Decisions that would help before then: O-1 (OTP vendors) and O-2 (object storage) in
`docs/DECISIONS.md`; both have workable defaults.

# Development guide

## Prerequisites

Node 22.18+ (`.nvmrc`), pnpm 10 (`corepack enable`), and PostgreSQL 16 with pgvector plus
Redis 7 — from Docker, or installed locally.

## First run

```bash
# Services — pick one
docker compose -f infrastructure/docker/compose.yaml up -d     # workstation
pnpm services:start                                            # Claude Code cloud container

cp .env.example apps/api/.env
pnpm install
pnpm db:deploy
pnpm build
```

## Daily commands

| Command                                 | What it does                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:api`                          | API with reload on `:4000`; OpenAPI UI at `/docs`                                                                                                         |
| `pnpm dev:mobile`                       | Expo dev server (press `w` for web)                                                                                                                       |
| `pnpm build`                            | Build packages then the API                                                                                                                               |
| `pnpm check`                            | Format check, lint, typecheck, unit tests                                                                                                                 |
| `pnpm test:e2e`                         | API end-to-end tests against real PostgreSQL and Redis                                                                                                    |
| `pnpm format`                           | Prettier write                                                                                                                                            |
| `pnpm --filter @vyra/mobile export:web` | Production web bundle into `apps/mobile/dist`                                                                                                             |
| `pnpm e2e:web <dir>`                    | Browser run of sign-up → onboarding → settings → deletion with screenshots (needs Playwright and a running API with `CORS_ORIGINS=http://localhost:8099`) |

## Environment variables

API (`apps/api/.env`, validated at boot by `src/config/env.ts`):

| Variable       | Default       | Purpose                                    |
| -------------- | ------------- | ------------------------------------------ |
| `NODE_ENV`     | `development` | `development`, `test` or `production`      |
| `PORT`         | `4000`        | HTTP port                                  |
| `DATABASE_URL` | —             | PostgreSQL connection string (required)    |
| `REDIS_URL`    | —             | Redis connection string (required)         |
| `AI_PROVIDER`  | `mock`        | `mock`, `openai` or `gemini`               |
| `CORS_ORIGINS` | empty         | Comma-separated browser origins allowed    |
| `LOG_LEVEL`    | `log`         | `error`, `warn`, `log`, `debug`, `verbose` |

| `JWT_ACCESS_SECRET`, `OTP_PEPPER`, `MEDIA_URL_SECRET` | — | Secrets, ≥ 32 characters each (required). `.env.example` has development values |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh-token lifetime |
| `OTP_DELIVERY` | `dev` | `dev` returns the code in the API response and sends nothing. Refused in production |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_DIR` | `local` / `./.storage` | Photo storage. `local` is refused in production |
| `PUBLIC_API_URL` | `http://localhost:4000` | Origin used in signed media URLs |

| `GEMINI_API_KEY` | — | Required only with `AI_PROVIDER=gemini` |
| `GEMINI_MODEL` / `GEMINI_EMBEDDING_MODEL` | `gemini-3.8-flash` / `gemini-embedding-001` | Gemini models |
| `PHOTO_MODERATION_PROVIDER` | `nsfwjs` | `nsfwjs` (open-source classifier, offline), `manual` (everything to a person) or `mock` (tests only; refused in production). E2E tests set `mock` |
| `RUN_QUEUE_WORKERS` | `true` | `false` stops this process running queue jobs; run `node apps/api/dist/worker.js` instead |

**Signing in during development:** no message is sent. The verification screen shows the code
under "Development build", and the API returns it as `devCode`.

Mobile (`apps/mobile/.env`): `EXPO_PUBLIC_API_URL` (default `http://localhost:4000`). On a
physical device use the machine's LAN address and add the Expo web origin to `CORS_ORIGINS`.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`, no `any` (lint error).
- API is ESM: relative imports end in `.js`. One Nest module per domain under
  `src/modules/<name>`; platform concerns under `src/config`, `src/database`, `src/redis`,
  `src/common`.
- Shapes shared across the wire live in `packages/validation` and nowhere else.
- Mobile: routes in `src/app`, everything else outside it; feature code under
  `src/features/<name>`; shared UI under `src/components`.
- Tests: `*.spec.ts` beside the code; API e2e in `apps/api/test/*.e2e-spec.ts`.
- Add Expo dependencies with `npx expo install` from `apps/mobile`.
- Schema changes: `.claude/skills/database-migrations`. UI: `.claude/skills/vyra-design-system`.
  Before calling anything done: `.claude/skills/quality-assurance`.

## Troubleshooting

- **`prisma migrate dev` hangs** — it is waiting for input because of drift. Use
  `--create-only`, then `migrate deploy`.
- **`Cannot find module '../generated/prisma/client.js'`** — run `pnpm db:generate`.
- **Mobile cannot see a change in a shared package** — run `pnpm build`.
- **Mobile typecheck complains that a route string is not assignable** — `apps/mobile/.expo/types`
  is stale. Delete that folder (the dev server regenerates it).
- **`pnpm e2e:web` fails with 429** — it requests four codes and the API allows five a minute
  per address. Wait a minute between runs.
- **Refreshing the place list**: `node scripts/build-places.mjs` (downloads GeoNames, needs
  `unzip`), then commit `packages/validation/src/places-data.ts`.
- **Becoming a moderator locally**: `psql … -c "update users set role='MODERATOR' where email='…'"`.
- **Health shows a dependency down** — start the services (`pnpm services:start` or compose).

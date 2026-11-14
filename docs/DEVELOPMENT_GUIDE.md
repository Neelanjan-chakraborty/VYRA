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

| Command                                 | What it does                                           |
| --------------------------------------- | ------------------------------------------------------ |
| `pnpm dev:api`                          | API with reload on `:4000`; OpenAPI UI at `/docs`      |
| `pnpm dev:mobile`                       | Expo dev server (press `w` for web)                    |
| `pnpm build`                            | Build packages then the API                            |
| `pnpm check`                            | Format check, lint, typecheck, unit tests              |
| `pnpm test:e2e`                         | API end-to-end tests against real PostgreSQL and Redis |
| `pnpm format`                           | Prettier write                                         |
| `pnpm --filter @vyra/mobile export:web` | Production web bundle into `apps/mobile/dist`          |
| `pnpm visual-check <dir>`               | Screenshot every tab at three sizes (needs Playwright) |

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
- **Health shows a dependency down** — start the services (`pnpm services:start` or compose).

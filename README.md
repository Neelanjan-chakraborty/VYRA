# VYRA

**Chemistry, decoded.** An AI-native relationship discovery platform that works out who you
might connect with, and why, before it shows you anyone.

This repository is a pnpm monorepo:

| Path                     | What it is                                                     |
| ------------------------ | -------------------------------------------------------------- |
| `apps/api`               | NestJS modular monolith — PostgreSQL (pgvector), Prisma, Redis |
| `apps/mobile`            | Expo / React Native app (iOS, Android, web)                    |
| `packages/validation`    | Zod schemas and types shared by API and clients                |
| `packages/design-system` | Design tokens                                                  |
| `docs`                   | Product, architecture, security and status documentation       |

## Quick start

Requirements: Node 22.18+, pnpm 10, Docker (or local PostgreSQL 16 with pgvector and Redis 7).

```bash
docker compose -f infrastructure/docker/compose.yaml up -d
cp .env.example apps/api/.env
pnpm install
pnpm db:deploy
pnpm build
pnpm dev:api        # http://localhost:4000/v1/health, OpenAPI at /docs
pnpm dev:mobile     # Expo dev server
```

Run every check with `pnpm check && pnpm test:e2e`.

Current state and what is not built yet: [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).
Full setup notes: [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md).

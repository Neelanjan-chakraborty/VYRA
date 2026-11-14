# VYRA

AI-native relationship discovery platform. Tagline: _Chemistry, decoded._ Not a swipe app:
compatibility-first discovery, evidence-aware personas, user-controlled AI.

## Layout

- `apps/api` — NestJS 12 modular monolith (ESM), Prisma 7, PostgreSQL 16 + pgvector, Redis.
- `apps/mobile` — Expo SDK 58 / React Native 0.88, Expo Router, TanStack Query.
- `packages/validation` — Zod schemas and inferred types shared by API and clients.
- `packages/design-system` — design tokens (colour, type, spacing, motion).
- `packages/compatibility-engine` — pure, deterministic compatibility scoring (no I/O).
- `docs/` — product, architecture, decisions, status. `infrastructure/docker` — local services.

## Commands

```bash
pnpm services:start          # start PostgreSQL + Redis in the cloud container
pnpm install
pnpm db:deploy               # apply migrations
pnpm build                   # packages, then API (turbo)
pnpm check                   # format:check + lint + typecheck + unit tests
pnpm test:e2e                # API end-to-end tests (needs the services)
pnpm dev:api                 # API on :4000, OpenAPI at /docs
pnpm dev:mobile              # Expo dev server
pnpm --filter @vyra/mobile export:web && pnpm e2e:web <dir>   # browser run of the account lifecycle
```

## Rules that are easy to get wrong

- **The stack is newer than your training data.** Check `docs/TECHNICAL_RESEARCH.md`, then
  `https://docs.expo.dev/llms.txt` and `https://docs.nestjs.com/llms.txt`, before using an API.
- **TypeScript is pinned to 6.0.x.** npm `latest` is 7, which Expo, the Nest CLI and
  `@nestjs/swagger` do not support yet. Prisma is pinned to 7.10.x (`latest` is an 8.0 RC).
- API code is ESM: relative imports end in `.js`. Mobile code uses the `@/` alias, no extension.
- Add Expo packages with `npx expo install <pkg>` from `apps/mobile` so versions match the SDK.
- Shared packages are consumed from `dist/`; run `pnpm build` after changing them.
- Validation is Zod everywhere. Request/response shapes live in `packages/validation`, never
  duplicated in an app. No `any`.
- Database changes: follow the `database-migrations` skill. Never edit an applied migration.
- UI work: follow the `vyra-design-system` skill. Tokens only, no raw hex or font sizes in screens.
- Persona and anything sent to a model: follow the `persona-engineering` skill.
- Scoring, gates or ranking: follow the `compatibility-engine` skill.
- AI output is untrusted data. Compatibility is computed deterministically, never by asking an
  LLM. Tests use the mock AI provider (`AI_PROVIDER=mock`).
- Never log message bodies, imported content, tokens or OTPs.
- A feature is done only when the `quality-assurance` skill's checklist passes. Update
  `docs/IMPLEMENTATION_STATUS.md` and `docs/DECISIONS.md` as you go.

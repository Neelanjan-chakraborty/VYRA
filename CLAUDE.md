# VYRA

AI-native relationship discovery platform. Tagline: _Chemistry, decoded._ Not a swipe app:
compatibility-first discovery, evidence-aware personas, user-controlled AI.

## Layout

- `apps/api` — NestJS 12 modular monolith (ESM), Prisma 7, PostgreSQL 16 + pgvector, Redis.
- `apps/mobile` — Expo SDK 58 / React Native 0.88, Expo Router, TanStack Query.
- `apps/landing` — marketing website: Next.js 16 App Router, Tailwind 4, Motion. Standalone; see
  its README. Pages are registered in `src/lib/routes.ts`.
- `packages/validation` — Zod schemas and inferred types shared by API and clients.
- `packages/design-system` — design tokens (colour, type, spacing, motion).
- `packages/compatibility-engine` — TypeScript reference engine (pure, deterministic, no I/O).
- `crates/vyra-engine` — the same engine in Rust (plus weight learning), used by the API
  in-process through `crates/vyra-engine-node` → `packages/engine-native` (napi-rs).
- `crates/vyra-realtime` — Rust WebSocket gateway (MessagePack): sockets, presence, typing.
  The API publishes id-only events on Redis; Nest still owns every write.
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
pnpm dev:realtime            # Rust realtime gateway on :4001 (needed for live updates)
pnpm rust:check              # cargo fmt --check + clippy -D warnings + cargo test
pnpm --filter @vyra/mobile export:web && pnpm e2e:web <dir>   # browser run of the account lifecycle
pnpm --filter @vyra/landing dev   # website on :3100; `seo:audit` and `visual:check` verify a build
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
- Website copy must match what is built: real screenshots only, and every capability labelled
  built / engine built / in development / planned. Never add a domain, address, statistic,
  testimonial or legal claim that has not been supplied.
- UI work: follow the `vyra-design-system` skill. Tokens only, no raw hex or font sizes in screens.
- Persona and anything sent to a model: follow the `persona-engineering` skill.
- Scoring, gates or ranking: follow the `compatibility-engine` skill. **Change the TypeScript
  reference and the Rust engine together**, then `pnpm engine:fixtures`; parity tests fail
  otherwise. The persona catalogue for Rust is generated (`pnpm engine:catalogue`).
- Rust: pinned by `rust-toolchain.toml`; `unsafe` is forbidden outside the napi bindings.
  Speed or size claims must come from the bench scripts, not estimates.
- AI output is untrusted data. Compatibility is computed deterministically, never by asking an
  LLM. Tests use the mock AI provider (`AI_PROVIDER=mock`).
- Never log message bodies, imported content, tokens or OTPs.
- A feature is done only when the `quality-assurance` skill's checklist passes. Update
  `docs/IMPLEMENTATION_STATUS.md` and `docs/DECISIONS.md` as you go.

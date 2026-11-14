---
name: quality-assurance
description: The verification loop every VYRA change must pass before it is called done. Use before committing, when finishing a feature or milestone, or when asked to test, verify or review work.
---

# Quality assurance

Files existing is not evidence. Run the checks and read the output.

## Loop

```bash
pnpm services:start        # cloud container only; elsewhere use docker compose
pnpm db:deploy
pnpm format:check && pnpm lint
pnpm build && pnpm typecheck
pnpm test
pnpm test:e2e
pnpm --filter @vyra/mobile export:web
CORS_ORIGINS=http://localhost:8099 node apps/api/dist/main.js &
pnpm e2e:web <output-dir>          # then open the screenshots and look at them
```

For API changes also boot it (`pnpm --filter @vyra/api build && node apps/api/dist/main.js`)
and call the new endpoint for real, including one unauthenticated and one malformed request.

## What must be tested

- Unit tests sit next to the code as `*.spec.ts`; API e2e tests live in `apps/api/test`.
- Every endpoint: success, validation failure, unauthenticated, and **another user's resource**
  (IDOR). Authorisation tests are mandatory, not optional.
- Scoring and other pure logic: deterministic tests with synthetic profiles, including missing
  data and boundary values.
- AI features run against the mock provider. Never spend real provider credits in tests.
- New database constraints get a test that violates them.
- UI: 320pt, 390pt and tablet widths; loading, empty, error and offline states; keyboard open;
  large text; reduced motion.

## Rules

- Never delete, skip or weaken a failing test to get green. Fix the code, or if the test is
  wrong, fix it and say why.
- Report results as they are: what ran, what passed, what was not run and why.
- Record the outcome in `docs/IMPLEMENTATION_STATUS.md`.
- The Expo web export is a proxy for native. Say so; do not claim iOS/Android were verified
  unless a device or emulator build actually ran.

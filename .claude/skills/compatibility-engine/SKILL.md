---
name: compatibility-engine
description: Rules for changing how VYRA scores, gates and ranks pairs of people. Use when touching packages/compatibility-engine, compatibility weights, scenarios, explanations, recommendation ranking, or the compatibility API.
---

# Compatibility engine

Read `docs/COMPATIBILITY_ENGINE.md` first. Engine: `packages/compatibility-engine/src`.
API: `apps/api/src/modules/compatibility/`.

## Non-negotiables

- Deterministic code only. Never ask a model whether two people are compatible.
- Unknown is unknown: a feature missing on either side contributes nothing.
- Missing data must never raise a score. Keep the shrink-to-neutral step and the
  INSUFFICIENT → no number rule (the database CHECK enforces the latter).
- Gates run in both directions. Never guess a gender, intention or trait to pass a gate.
- Must-haves fire only on known values; preferences only adjust the score; "open" does nothing.
- A missing location never excludes anyone; unlisted gender identities are included by default.
- Never put a photo in a non-owner response unless it is APPROVED (use `PeopleService`).
- Only approved persona versions feed the engine.
- Ineligible pairs are a plain 404 to the viewer; never reveal which gate failed.
- Results are "estimated alignment". No predictive or scientific claims in code, copy or docs.

## Changing behaviour

1. Scoring logic change → bump `ENGINE_VERSION` in `score.ts` (cache keys include it).
2. Weight change → add a new row to `compatibility_weight_sets` in a migration and make it the
   only active one; never edit an existing version.
3. New feature or scenario → define it explicitly in `features.ts` / `SCENARIO_FEATURES`,
   give it explanation sentences, and add synthetic tests: present, absent, opposite,
   symmetric.
4. Run `pnpm --filter @vyra/compatibility-engine test` and `pnpm test:e2e`; update the doc's
   tables and sample outputs if numbers moved.

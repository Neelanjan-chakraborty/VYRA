# Implementation backlog

Ordered. A milestone is done only when the Definition of Done in
`.claude/skills/quality-assurance` holds. Status lives in IMPLEMENTATION_STATUS.md.

## Milestone 0 — Audit and plan ✅

## Milestone 1 — Foundation ✅

## Milestone 2 — Design and authentication ✅

Carried forward from Milestone 2 (not blocking Milestone 3):

- Real OTP delivery adapter (SMS and e-mail) — needs decision O-1.
- S3-compatible storage adapter — needs decision O-2.
- Terms of Service and Privacy Policy documents, linked from the consent screen.
- Redis-backed rate-limit store before running more than one API instance.
- Mobile component tests (`jest-expo` + Testing Library), starting with the session refresh
  logic in `src/lib/api.ts`.
- Drag-and-drop photo reordering; country picker for phone numbers.
- Native device pass: Keychain storage, photo picker permissions, keyboard, SMS autofill.
- Scheduled clean-up of expired OTP challenges and sessions.

## Milestone 3 — AI Persona (next)

Persona Zod schema (versioned) · `AiProvider` interface + deterministic mock + Gemini adapter ·
generation worker (BullMQ) · calibration and contradiction handling · draft/approve/edit API ·
persona review and persona screens · embeddings into `vyra_vector` · tests incl.
prompt-injection fixtures and sensitive-trait filter.

## Milestone 4 — Compatibility

`@vyra/compatibility-engine` package: feature extraction, similarity functions, weighted
confidence-aware score, sufficiency states, gates, ten scenarios, explanations · API service
with cache in `compatibility_scores` · ranking service · synthetic-profile test suite.

## Milestone 5 — Discovery

Recommendation API · Orbit (gesture canvas + accessible list view) · Deep Discover profile
reading · compatibility detail screen · save / pass / connect · discovery events · filters.

## Milestone 6 — Social

Connection lifecycle · matches · Socket.IO messaging with Redis adapter (delivery, typing,
read receipts honouring privacy switches) · media messages · notifications · Wingman
(suggest-only, opt-in context) · date planning · block and report.

## Milestone 7 — Advanced intelligence

ChatGPT export import and Gemini Takeout import (isolated worker, archive limits, redaction,
approval UI, raw deletion) · BestPic · TrendSync · Astrology (deterministic ephemeris
library) · advanced scenarios.

## Milestone 8 — Production readiness

Admin console (`apps/admin`, role-restricted, audited) · security review and fixes · load
testing and query/index tuning · Sentry and PostHog · retention jobs · EAS builds · deployment
and backup runbooks · regression suite.

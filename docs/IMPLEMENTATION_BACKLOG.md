# Implementation backlog

Ordered. A milestone is done only when the Definition of Done in
`.claude/skills/quality-assurance` holds. Status lives in IMPLEMENTATION_STATUS.md.

## Milestone 0 — Audit and plan ✅

## Milestone 1 — Foundation ✅

## Milestone 2 — Design and authentication (next)

API

1. `auth` module: request OTP (e-mail/phone), verify OTP, refresh, logout. Hashed OTPs with
   attempt caps and expiry; short-lived access JWT (`jose`); rotating hashed refresh tokens
   with reuse detection. `OtpSender` interface with a development fake.
2. Auth guard, `@CurrentUser()`, role guard; per-route throttles on OTP endpoints.
3. Age gate (18+) and consent recording (`user_consents`) at sign-up.
4. `users` / `profiles`: `GET/PATCH /v1/me`, relationship intents, discovery preferences.
5. `photos`: upload with content sniffing, size caps, re-encode, EXIF strip; storage interface
   with a local adapter; signed read URLs; ordering; delete.
6. Account deletion (soft delete + session revocation), audit log entries.
7. Tests: auth flows, brute-force limits, token rotation and reuse, IDOR on every `/me`
   resource, under-age rejection, upload rejection cases.

Mobile 8. Design-system components: Button, TextField, OTP input, BottomSheet, Modal, Avatar, photo
tile, loading/empty/error states, reduced-motion hook. 9. Animated splash and brand introduction. 10. Auth screens: phone/e-mail entry, OTP, age, consent. Secure token storage
(`expo-secure-store`), session store (Zustand), authenticated API client with refresh. 11. Onboarding navigation shell: identity → photos → (optional import) → (optional interests)
→ intention → preferences. Optional steps skippable. 12. Profile editing and settings screens (privacy, discovery, account deletion). 13. Component tests (`jest-expo` + Testing Library) and visual check of every new screen.

## Milestone 3 — AI Persona

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

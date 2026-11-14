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

## Milestone 3 — AI Persona ✅

Carried forward from Milestone 3:

- Verify the Gemini adapter against the live API once a key is configured; review the
  privacy notice before enabling it for real users.
- Redis-backed rate-limit store and a separate worker deployment before scaling out.
- Remember attributes a person removed, so a later generation doesn't suggest them again.
- Embedding backfill job for approved versions whose embedding failed to store.
- Mobile component tests for the persona review and questionnaire screens.

## Milestone 4 — Compatibility ✅

Carried forward from Milestone 4:

- Reciprocal interest in ranking once connection requests exist.
- Index review of the candidate query with realistic data volumes (Milestone 8).

## Milestone 5 — Discovery ✅

Connection lifecycle API (save, pass, request with note, accept/decline/withdraw, mutual,
end, block/unblock) · one visibility rule · recommendation exclusions · Orbit (pan/pinch canvas
with Zoom/Re-centre buttons and list view) · Deep Discover profile with action bar · full
compatibility screen · Discover filters with Save/Pass · Connections tab · Blocked people.

Carried forward: admin moderation UI (Milestone 8 console); learning from discovery events
(Milestone 7); request expiry job (requests stay pending until answered or withdrawn).

## Milestone 6 — Social

Socket.IO messaging with Redis adapter (delivery, typing,
read receipts honouring privacy switches) · media messages · notifications · Wingman
(suggest-only, opt-in context) · date planning.

## Milestone 7 — Advanced intelligence

ChatGPT export import and Gemini Takeout import (isolated worker, archive limits, redaction,
approval UI, raw deletion) · BestPic · TrendSync · Astrology (deterministic ephemeris
library) · advanced scenarios.

## Milestone 8 — Production readiness

Admin console (`apps/admin`, role-restricted, audited) · security review and fixes · load
testing and query/index tuning · Sentry and PostHog · retention jobs · EAS builds · deployment
and backup runbooks · regression suite.

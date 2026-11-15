# API specification

Base URL: `/v1`. The generated OpenAPI document is served by a non-production API at `/docs`
(UI) and `/docs/openapi.json`. This file records conventions and the endpoints that exist.

## Conventions

- JSON in, JSON out. Request and response shapes are Zod schemas in `@vyra/validation`.
- Every response carries `x-request-id`. A client may send its own (8–64 chars of
  `A-Z a-z 0-9 . _ -`); anything else is replaced.
- Errors always use one envelope:

  ```json
  {
    "error": {
      "code": "NOT_FOUND",
      "message": "…",
      "details": [{ "path": "…", "message": "…" }],
      "requestId": "…"
    }
  }
  ```

  Codes: `BAD_REQUEST`, `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `CONFLICT`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.
  5xx messages are generic; details go to the logs only.

- Rate limit: 120 requests/minute per IP by default (`429 RATE_LIMITED`).
- Authentication: `Authorization: Bearer <access token>`. Every route requires it unless
  marked public.

## Implemented

Validation failures return `422 VALIDATION_FAILED` with `details[]`. Routes marked 🔒 need a
bearer token; everything else is public.

### Health

| Method | Path              | Description                                                         |
| ------ | ----------------- | ------------------------------------------------------------------- |
| GET    | `/v1/health/live` | Liveness. `200 {"status":"ok"}` without touching dependencies       |
| GET    | `/v1/health`      | Readiness. `200` when PostgreSQL and Redis respond, `503` otherwise |

### Authentication

| Method | Path                   | Limit / min                            | Description                                                                                                                                                                                                                                                        |
| ------ | ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/v1/auth/otp/request` | 5 per IP, 3 per destination per 10 min | Body `{channel, destination}`. `202 {challengeId, expiresInSeconds}`. Same answer whether or not an account exists. With the development sender the response also carries `devCode`                                                                                |
| POST   | `/v1/auth/otp/verify`  | 10                                     | Body `{channel, destination, challengeId, code}`. `200` with `{status:"authenticated", tokens}` for an existing account or `{status:"registration_required", registrationToken}` for a new destination. Wrong, expired, replayed or exhausted (5 attempts) → `401` |
| POST   | `/v1/auth/register`    | 10                                     | Body `{registrationToken, dateOfBirth, acceptedTermsVersion, acceptedPrivacyVersion}`. `201` tokens. Under 18 → `403`, nothing stored. Existing account → `409`                                                                                                    |
| POST   | `/v1/auth/refresh`     | 30                                     | Body `{refreshToken}`. `200` new token pair; the old refresh token is dead. Re-using a rotated token revokes every session of the account                                                                                                                          |
| POST   | `/v1/auth/logout` 🔒   |                                        | `204`. Ends the current session immediately                                                                                                                                                                                                                        |

Tokens: access token is a 15-minute HS256 JWT; refresh token is opaque, 30 days, single use.
Every authenticated request checks the session row, so logout, reuse detection, suspension
and deletion take effect at once.

### Account and profile 🔒

| Method | Path                           | Description                                                                                                                              |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/me`                       | Account, profile, photos (signed URLs), intentions, preferences, interests, `onboardingMissing`. Contact details are masked              |
| PATCH  | `/v1/me/profile`               | Partial update. `displayName` required on first save. Empty string or `null` clears an optional field. `isDiscoverable` only once active |
| PUT    | `/v1/me/relationship-intents`  | Replace all. 1–5, unique kinds, `customLabel` required for `other` only                                                                  |
| PUT    | `/v1/me/discovery-preferences` | Replace. Ages 18–120, `maxAge ≥ minAge`, `maxDistanceKm` or `null`                                                                       |
| GET    | `/v1/interests`                | Interest catalogue                                                                                                                       |
| PUT    | `/v1/me/interests`             | Replace selection (≤ 20, must exist)                                                                                                     |
| POST   | `/v1/me/onboarding/complete`   | Needs profile, ≥ 1 photo, ≥ 1 intention (`409` otherwise). Sets status `ACTIVE`, discoverable                                            |
| DELETE | `/v1/me`                       | Body `{confirm:"DELETE"}`. `204`. Removes personal data and files, ends all sessions                                                     |

### Photos 🔒

| Method | Path                                      | Description                                                                                                                                                                                                                                                                                                                                        |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/me/photos`                           | `multipart/form-data`, field `file`. Declared type must be `image/jpeg`, `image/png` or `image/webp` (`415` otherwise) **and** match the actual bytes (`400`). ≤ 10 MB (`413`), 400–8000 px per side, ≤ 50 MP. Re-encoded to JPEG ≤ 2048 px with all metadata removed. Max 6, no duplicates (`409`). Starts `PENDING` and is queued for moderation |
| PUT    | `/v1/me/photos/:photoId`                  | Replace a photo in place: new image, back to `PENDING`, re-moderated; URLs of the old image stop working                                                                                                                                                                                                                                           |
| POST   | `/v1/me/photos/:photoId/appeal`           | `204`. Ask a person to review a `REJECTED` photo; once per upload (`409` otherwise)                                                                                                                                                                                                                                                                |
| PUT    | `/v1/me/photos/order`                     | Body `{photoIds}` naming every photo once                                                                                                                                                                                                                                                                                                          |
| DELETE | `/v1/me/photos/:photoId`                  | `204`. Another person's photo id → `404`                                                                                                                                                                                                                                                                                                           |
| GET    | `/v1/media/photos/:owner/:file?s&exp&sig` | Signed, 10-minute URL with a scope: `o` owner, `p` public, `m` moderator. Checked against the database on every request: a public URL serves only an `APPROVED` photo of an active, discoverable person. Anything else → `404`                                                                                                                     |

The owner's photo list (in `/v1/me`) includes `status` (`PENDING`, `APPROVED`, `REJECTED`,
`REVIEW_REQUIRED`), `reason` and `canAppeal`. No other response ever contains a photo that is
not `APPROVED`.

### Moderation 🔒 (role `MODERATOR` or `ADMIN`)

| Method | Path                                      | Description                                                                                                                       |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/moderation/photos`                   | Photos in `REVIEW_REQUIRED` (inconclusive, appealed or reported), oldest first, with moderator-scoped URLs and open report counts |
| POST   | `/v1/moderation/photos/:photoId/decision` | Body `{decision: approve\|reject, reason}`. `204`. Resolves open reports on the photo. Audited                                    |

### Reports 🔒

| Method | Path          | Description                                                                                                                                                                                                                                                                                                          |
| ------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/reports` | Body `{reportedUserId, reason, details?, photoId?, messageId?}` (photo or message, not both). `202`. Not yourself (`400`). A photo is hidden for review once 2 different people report it. A message must be one the reporter received from the reported person (else `404`); it is hidden from the reporter at once |

### Location 🔒

| Method | Path                       | Description                                                                                                                                                                                                                                                                                               |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PUT    | `/v1/me/location`          | `{source:"device", latitude, longitude}` (snapped to a 0.02° grid, labelled with the nearest listed place) or `{source:"manual", countryCode, placeId?, city?, area?}` (a listed place's centre; an unlisted city is a label with no distance). Returns the location view. Coordinates are never returned |
| DELETE | `/v1/me/location`          | `204`. Clears every location field                                                                                                                                                                                                                                                                        |
| GET    | `/v1/places?country=IN&q=` | Place search (GeoNames, CC BY 4.0)                                                                                                                                                                                                                                                                        |

### Consents 🔒

| Method | Path                    | Description                                                                                                                                                                                                        |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/v1/me/consents`       | Each optional consent and whether it is granted                                                                                                                                                                    |
| PUT    | `/v1/me/consents/:type` | Body `{granted}`. Types: `AI_PERSONA_PROCESSING`, `AI_IMPORT_PROCESSING`, `PHOTO_ANALYSIS`, `ASTROLOGY`, `WINGMAN_MESSAGE_CONTEXT`, `ANALYTICS`, `MARKETING`. Withdrawing either AI consent deletes persona drafts |

### Persona 🔒

| Method | Path                                  | Description                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/me/persona`                      | `{generation:{status,failureCode}, current, draft}`; each version lists attributes with evidence and the `unknown` keys                                                                                                                                                     |
| POST   | `/v1/me/persona/generate`             | `202`. Needs `AI_PERSONA_PROCESSING` (`409` otherwise). One in flight (`409`), one a minute (`429`). Failure codes: `nothing_to_read`, `provider_unavailable`, `provider_bad_response`, `provider_error`                                                                    |
| POST   | `/v1/me/persona/assistant-reflection` | Body `{assistant, reply}` (reply ≤ 20 000 chars). Needs `AI_IMPORT_PROCESSING`. `200 {result:{accepted,unknown,rejected}, persona}`. Unusable reply → `422` with `details[0].message` one of `no_json`, `invalid_json`, `wrong_shape`, `wrong_version`, `no_usable_answers` |
| PATCH  | `/v1/me/persona/draft`                | Body `{set?, confirm?, clear?}`; opens a draft from the approved persona if none. Invalid values → `422` per field                                                                                                                                                          |
| POST   | `/v1/me/persona/draft/approve`        | Draft becomes current; embedding stored. No draft → `404`; empty → `409`                                                                                                                                                                                                    |
| DELETE | `/v1/me/persona/draft`                | Discard the draft                                                                                                                                                                                                                                                           |
| DELETE | `/v1/me/persona`                      | `204`. Deletes every version, evidence and embedding                                                                                                                                                                                                                        |

### Compatibility and discovery 🔒

| Method | Path                                     | Description                                                                                                                                                                                                                                                                                                                                 |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/discovery/recommendations?limit=20` | Up to 50 ranked people (`recommendationListSchema`): name, age, city, approved photo or `null`, distance band or `null`, `overall` (null when insufficient), `confidence`, `sufficiency`, highlights, shared interests; plus `distanceFilter` (`active`, `no_location`, `off`) and engine/weights versions. Viewer still onboarding → `409` |
| GET    | `/v1/people/:userId`                     | Profile preview (`publicProfileSchema`): name, age, city, bio, occupation, gender only if shown, distance band, approved photos only, interests, interests both chose. Same 404 rules as below                                                                                                                                              |
| GET    | `/v1/discovery/criteria-impact`          | How much the viewer's must-haves narrow things, in buckets (`0`, `1–5`, `6–20`, `20+`), with `significant` when they remove ≥ 50 % of a pool of ≥ 10                                                                                                                                                                                        |
| GET    | `/v1/compatibility/:userId`              | Full result for one person (`compatibilityViewSchema`): overall, six dimensions with features and explanations, ten scenarios. Anyone the viewer may not see — hidden, blocked, outside either person's limits, deleted, self — is `404 Not found.`                                                                                         |

`PUT /v1/me/discovery-preferences` takes `minAge`, `maxAge`, `maxDistanceKm` (or null),
`showGenders` (any of `WOMAN`, `MAN`, `NON_BINARY`; empty = everyone),
`includeUnlistedGenders` (default true), `showAstrology` and `criteria`: up to 5
`{criterion, mode: must|prefer|open, accepted[]}` for `relationshipIntent`, `lifestylePace`,
`weekendRhythm`, `communicationStyle`, `values`. Criteria are never shown to anyone else.

`PATCH /v1/me/profile` takes `genderIdentity` (`WOMAN`, `MAN`, `NON_BINARY`, `SELF_DESCRIBE`,
`PREFER_NOT_TO_SAY` or null), `genderSelfDescription` and `discoverableAs` (only with
`SELF_DESCRIBE`, else `422`), and `genderVisible` (default false). City and country now come
from `/v1/me/location`.

Visibility (one rule, `PeopleService.visiblePair`): never across a block, never a deleted or
suspended account, never yourself. Otherwise someone is visible if they could be recommended
(discoverable and passing every gate both ways) **or** the two of you already have a pending
request or an active mutual connection — so people don't vanish when someone edits
preferences or hides from discovery. Recommendations additionally leave out people you saved,
passed in the last 30 days, or have a pending request or connection with; those live in
Connections.

### Connections 🔒

| Method | Path                                    | Description                                                                                                                                                                                                                                                                                             |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/connections`                       | `connectionsSchema`: `incoming`, `outgoing` (pending requests), `mutual` (active matches), `saved`. Each item: `id` (request or match id, null for saved), `person` summary (approved photo or null, distance band, estimated alignment), `note` (only to its sender and recipient), `createdAt`        |
| GET    | `/v1/people/:userId/relationship`       | `relationshipStateSchema`: `saved`, `outgoingRequestId`, `incomingRequestId`, `matchId`, `requestBlockedReason` (`declined_recently`, `too_many_pending` or null)                                                                                                                                       |
| PUT    | `/v1/saved/:userId`                     | Save (idempotent). Target must be visible, else `404`                                                                                                                                                                                                                                                   |
| DELETE | `/v1/saved/:userId`                     | Unsave                                                                                                                                                                                                                                                                                                  |
| POST   | `/v1/discovery/pass/:userId`            | Hidden from recommendations for 30 days                                                                                                                                                                                                                                                                 |
| POST   | `/v1/connections/requests`              | Body `{recipientId, note?}` (note ≤ 300 chars, control characters removed, stored and shown as plain text). `connectResultSchema`: `outcome` `requested`, or `matched` when they had already asked you. `409` when already connected, already pending, declined within 30 days, or ≥ 20 pending. 20/min |
| POST   | `/v1/connections/requests/:id/accept`   | Recipient only; creates (or revives) the match. Anyone else → `404`                                                                                                                                                                                                                                     |
| POST   | `/v1/connections/requests/:id/decline`  | Recipient only; starts the 30-day cool-down for the sender                                                                                                                                                                                                                                              |
| POST   | `/v1/connections/requests/:id/withdraw` | Sender only; they may ask again later                                                                                                                                                                                                                                                                   |
| DELETE | `/v1/connections/matches/:id`           | Either participant ends it                                                                                                                                                                                                                                                                              |
| GET    | `/v1/blocks`                            | `blockedListSchema`: names and dates only                                                                                                                                                                                                                                                               |
| POST   | `/v1/blocks/:userId`                    | Ends any match, expires pending requests both ways, removes saves both ways, hides both people from each other everywhere. Audited                                                                                                                                                                      |
| DELETE | `/v1/blocks/:userId`                    | Unblock. Restores eligibility, not the earlier connection                                                                                                                                                                                                                                               |

### Messaging 🔒

Only the two participants of a conversation can see or act on it; anyone else, and both people
across a block, get `404`. After a connection ends the conversation is read-only (`409` on
send). Shapes are in `packages/validation/src/messaging.ts`.

| Method | Path                              | Description                                                                                                                                                                                                                             |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/conversations`               | `conversationListSchema`: person summary, last-message preview (text cut to 80 chars; media and plans in words), `unread` (a flag, not a count), `readOnly`, the viewer's settings                                                      |
| GET    | `/v1/conversations/:id`           | One summary                                                                                                                                                                                                                             |
| GET    | `/v1/conversations/:id/messages`  | `?before=<messageId>&limit≤40`. Newest first, `nextBefore` for older. Each message: kind, plain-text body, media (`checking` / `ready` / `declined`, signed URL only when allowed), plan, `read`                                        |
| POST   | `/v1/conversations/:id/messages`  | `{kind:'text', clientId, body ≤ 2000, aiAssisted?}` or `{kind:'date_plan', clientId, plan:{idea, when?, area?}}`. Idempotent on `clientId`. 30/min                                                                                      |
| POST   | `/v1/conversations/:id/media`     | Multipart `file` + `kind=image` (JPEG/PNG/WebP ≤ 10 MB, re-encoded, classifier before delivery) or `kind=voice` + `durationMs` (M4A/WebM, ≤ 2 MB, ≤ 60 s from the file when recorded). 20/min                                           |
| POST   | `/v1/conversations/:id/read`      | `{upTo: messageId}`. Tells the other person only if the reader shares read receipts                                                                                                                                                     |
| PATCH  | `/v1/conversations/:id/settings`  | Any of `sendsReadReceipts` (reciprocal), `sharesTyping`, `wingmanContextEnabled`, `muted`, `restricted` (they get no pushes, read receipts or typing from you; not told), `theme` (`default`/`dusk`/`ivory`/`sage`/`amber`, yours only) |
| POST   | `/v1/conversations/:id/wingman`   | `{purpose: opener \| reply \| date_idea}` → `{suggestions ≤ 3, usedMessages}`. Needs the `WINGMAN` consent (`409` otherwise). Never sends. 10/min                                                                                       |
| DELETE | `/v1/messages/:id`                | Sender only; erases text and media for both                                                                                                                                                                                             |
| PUT    | `/v1/messages/:id/reaction`       | `{emoji}` from ❤️ 😂 😮 😢 👍 🔥. One per person per message; replaces yours. `DELETE` removes it. Returns the message                                                                                                                  |
| POST   | `/v1/messages/:id/pin`            | Either participant; both see it. At most 3 pinned (`409`). `DELETE` unpins                                                                                                                                                              |
| GET    | `/v1/conversations/:id/pinned`    | `{messages}`, most recently pinned first                                                                                                                                                                                                |
| PATCH  | `/v1/messages/:id`                | `{body}`. Your own text, within 15 min of sending (`409` after). The earlier text is replaced, not kept; the message shows `edited`                                                                                                     |
| POST   | `/v1/messages/:id/forward`        | `{conversationIds: 1–5}` → `{forwarded}`. Your own text only (`422` otherwise), to your own open conversations (`404` otherwise). Media is never forwardable. 10/min                                                                    |
| POST   | `/v1/conversations/:id/scheduled` | `{body, sendAt}`; `sendAt` in the next 7 days (`422`), ≤ 10 waiting per conversation (`409`). Sent by a BullMQ delayed job only if the connection is still open, else marked `FAILED`                                                   |
| GET    | `/v1/conversations/:id/scheduled` | Your own waiting (`PENDING`) and `FAILED` scheduled messages. The other person never sees them                                                                                                                                          |
| DELETE | `/v1/scheduled/:id`               | Cancel (or dismiss a failed one). Yours only                                                                                                                                                                                            |
| POST   | `/v1/messages/:id/plan/:action`   | `accept` / `decline` by the recipient, `withdraw` by the proposer; anyone else `404`; once only (`409`)                                                                                                                                 |
| PUT    | `/v1/me/push-devices`             | `{token, platform: ios \| android \| web}`; a token moves to whoever registers it last                                                                                                                                                  |
| DELETE | `/v1/me/push-devices`             | `{token}`                                                                                                                                                                                                                               |

`PATCH /v1/me/profile` also takes `notifyMessages`, `notifyRequests`, `notifyPreview` (`name` or `hidden`: "New message" with no name) and the defaults new conversations start with, `defaultReadReceipts` and `defaultSharesTyping`.

Each message also carries `replyTo` (`{id, mine, preview}`, "Message removed" once gone; send with `replyToId` in the same conversation), `reactions` (`[{emoji, count, mine}]`), `edited`, `pinned`, `forwarded` and `editable`. New `conversation.changed` reasons: `reaction`, `edited`, `pinned`.

**Realtime** — the Rust gateway (`crates/vyra-realtime`), `ws(s)://<host>/v1/realtime`
(port 4001 in development). Binary WebSocket frames, MessagePack maps:

| Direction     | Frame                             | Notes                                                                                                                                             |
| ------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| app → gateway | `{t:"auth", token}`               | Must be the first frame, within 5 s. Never put the token in the URL                                                                               |
| app → gateway | `{t:"typing", c: conversationId}` | Relayed only if allowed (see below); 2 s per conversation                                                                                         |
| app → gateway | `{t:"ping"}`                      | Optional app heartbeat                                                                                                                            |
| gateway → app | `{t:"ready"}`                     | Authenticated                                                                                                                                     |
| gateway → app | `{t:"event", e, d}`               | `e`: `conversation.changed` (`d: {conversationId, reason, by}`), `typing` (`d: {conversationId}`), `list.changed` (`d: {}`). Ids only, never text |
| gateway → app | `{t:"pong"}`                      |                                                                                                                                                   |

Close codes: `4000` signed out (that device, or all devices on deletion), `4001` token or
session refused, `4002` malformed frame, `4008` no auth frame in time, `4029` more than 20
frames a second. Browsers must send an allowed `Origin`. The API publishes events as JSON on
Redis channel `<namespace>:realtime` (`{userIds, event, payload}`, `{disconnect: [userId]}`,
`{disconnectSessions: [sessionId]}`); presence is `<namespace>:presence:<userId>`.

**Media variants.** Photos come with `thumbUrl` (320 px AVIF; null for older JPEG photos).
Message media has `thumbUrl` (images) and `altUrl` (voice: CAF for iOS); `url` is AVIF or
Ogg Opus. Owner URLs are cacheable for their 10-minute life, others' for 60 s. JSON responses
over 1 KB are brotli/gzip-compressed when the client accepts it.

### Admin 🔒 (role `ADMIN`)

| Method | Path                                 | Description                                                                                                                                                                              |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/admin/weights`                  | `weightSetListSchema`: every weight set with status (`PROPOSED`, `APPROVED`, `REJECTED`), `isActive`, `basedOn`, metrics (sample counts, coefficients, held-out AUC current vs proposed) |
| POST   | `/v1/admin/weights/fit`              | Run the Rust learner now (normally weekly): `{status: proposed \| insufficient_data \| no_improvement, version, metrics}`                                                                |
| POST   | `/v1/admin/weights/:version/approve` | A `PROPOSED` set becomes the only active one (`409` if already decided)                                                                                                                  |
| POST   | `/v1/admin/weights/:version/reject`  | `PROPOSED` → `REJECTED` (`404` otherwise)                                                                                                                                                |

## Planned

Endpoint groups arrive with their milestones (see IMPLEMENTATION_BACKLOG.md): `imports`,
`safety`, `admin`. Each is documented here when it is implemented and tested,
not before.

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

| Method | Path                                    | Description                                                                                                                                                                              |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/me/photos`                         | `multipart/form-data`, field `file`. JPEG/PNG/WebP judged by content, ≤ 10 MB (`413`), ≥ 400 px. Re-encoded to JPEG ≤ 2048 px with all metadata removed. Max 6 and no duplicates (`409`) |
| PUT    | `/v1/me/photos/order`                   | Body `{photoIds}` naming every photo once                                                                                                                                                |
| DELETE | `/v1/me/photos/:photoId`                | `204`. Another person's photo id → `404`                                                                                                                                                 |
| GET    | `/v1/media/photos/:owner/:file?exp&sig` | Public but only with a valid signature (10-minute lifetime). Anything else → `404`                                                                                                       |

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

| Method | Path                                     | Description                                                                                                                                                                                                                                            |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/v1/discovery/recommendations?limit=20` | Up to 50 ranked people (`recommendationListSchema`): name, age, city, approved photo, `overall` (null when insufficient), `confidence`, `sufficiency`, highlights, shared interests, plus engine and weights versions. Viewer still onboarding → `409` |
| GET    | `/v1/compatibility/:userId`              | Full result for one person (`compatibilityViewSchema`): overall, six dimensions with features and explanations, ten scenarios. Anyone the viewer may not see — hidden, blocked, outside either person's limits, deleted, self — is `404 Not found.`    |

`PUT /v1/me/discovery-preferences` also accepts `dealBreakers`: up to 5
`{kind:"attribute", attribute:"lifestylePace"|"weekendRhythm"|"communicationStyle", exclude:[…]}`.

## Planned

Endpoint groups arrive with their milestones (see IMPLEMENTATION_BACKLOG.md): `persona`, `imports`, `discovery`, `compatibility`, `connections`,
`conversations`, `safety`, `admin`. Each is documented here when it is implemented and tested,
not before.

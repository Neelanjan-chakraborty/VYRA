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
- Authentication (from Milestone 2): `Authorization: Bearer <access token>`.

## Implemented

| Method | Path              | Auth | Description                                                         |
| ------ | ----------------- | ---- | ------------------------------------------------------------------- |
| GET    | `/v1/health/live` | none | Liveness. `200 {"status":"ok"}` without touching dependencies       |
| GET    | `/v1/health`      | none | Readiness. `200` when PostgreSQL and Redis respond, `503` otherwise |

`GET /v1/health` body (`healthResponseSchema`):

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptimeSeconds": 42,
  "checks": { "database": "up", "redis": "up" }
}
```

## Planned

Endpoint groups arrive with their milestones (see IMPLEMENTATION_BACKLOG.md): `auth`, `me`,
`profiles`, `photos`, `persona`, `imports`, `discovery`, `compatibility`, `connections`,
`conversations`, `safety`, `admin`. Each is documented here when it is implemented and tested,
not before.

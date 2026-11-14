# Deployment guide

Status: **nothing is deployed, and no deployment has been tested.** This records the intended
shape so later work converges on it. It becomes a runbook in Milestone 8.

## Target topology

| Component | Runs as                                                           |
| --------- | ----------------------------------------------------------------- |
| API       | Container, ≥ 2 instances behind a TLS-terminating load balancer   |
| Workers   | Same image, different entry point, scaled on queue depth          |
| Database  | Managed PostgreSQL 16 with the `vector` extension, PITR backups   |
| Redis     | Managed Redis 7                                                   |
| Storage   | S3-compatible private bucket (photos, import archives)            |
| Mobile    | EAS Build → App Store / Play Store; EAS Update for OTA JS updates |

Primary region should be in India for the first market (latency and data-residency posture).

## Release steps (intended)

1. CI green on the commit (`.github/workflows/ci.yml`).
2. Build the API image.
3. Run `prisma migrate deploy` as a one-off job **before** rolling out new code. Migrations
   must be backward compatible with the previous release (expand → migrate → contract).
4. Roll out API and workers; readiness is `GET /v1/health`, liveness `GET /v1/health/live`.
5. Mobile: `eas build` per platform, internal testing, staged rollout.

## Requirements before a first production deployment

- The database role can `CREATE EXTENSION vector` (or the extension is pre-installed).
- Secrets come from the platform's secret manager; nothing is baked into images.
- `NODE_ENV=production` (JSON logs, OpenAPI UI disabled), `CORS_ORIGINS` set explicitly.
- Backups: automated daily snapshots plus point-in-time recovery, with a rehearsed restore.
- Error monitoring and alerting connected (Sentry planned), dashboards for health and queues.
- A human approves every production deployment.

## Not decided yet

Hosting provider, container registry, SMS/e-mail vendors, object-storage vendor, payment
provider. See DECISIONS.md, "Open".

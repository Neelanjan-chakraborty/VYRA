# Database schema

PostgreSQL 16. Source of truth: `apps/api/prisma/schema.prisma` plus the SQL in
`apps/api/prisma/migrations` (CHECK constraints, partial indexes and the pgvector table exist
only in SQL). How to change it: the `database-migrations` skill.

## Conventions

- Tables and columns are `snake_case`; primary keys are UUIDs; timestamps are `timestamptz(3)`.
- Every foreign key declares `ON DELETE`. Deleting a user cascades to everything they own.
  Records that must outlive them — safety reports, moderation events, audit logs, the other
  person's copy of a conversation — keep the row and null the reference.
- Symmetric pairs (`matches`, `compatibility_scores`) are stored once with
  `user_a_id < user_b_id`, enforced by a CHECK.
- Scores and confidences are constrained to `[0, 1]`.

## Tables

| Area          | Tables                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Identity      | `users`, `otp_challenges`, `auth_sessions`, `user_consents`                                                    |
| Profile       | `user_profiles`, `user_photos`, `interests`, `user_interests`, `relationship_intents`, `discovery_preferences` |
| Persona       | `personas`, `persona_versions`, `persona_evidence`, `vyra_vector.persona_embeddings`, `ai_imports`             |
| Compatibility | `compatibility_weight_sets`, `compatibility_scores`, `compatibility_scenarios`                                 |
| Discovery     | `discovery_events`, `saved_profiles`, `connection_requests`, `matches`                                         |
| Messaging     | `conversations`, `conversation_participants`, `messages`                                                       |
| Optional      | `trends`, `astrology_profiles`                                                                                 |
| Commercial    | `subscriptions`, `user_feedback`                                                                               |
| Safety        | `safety_reports`, `blocked_users`, `moderation_events`, `audit_logs`                                           |

Tables added beyond the original entity list, and why: `otp_challenges` and `auth_sessions`
(authentication needs them), `user_consents` (consent ledger), `interests` (normalises
`user_interests`), `compatibility_weight_sets` (versioned weights), `saved_profiles` (a list,
not just an event), `conversation_participants` (per-person read state and privacy switches).

## Design notes

**Secrets are never stored.** OTP codes, OTP destinations and refresh tokens are stored as
hashes only.

**Persona versioning.** `personas` points at one approved `persona_versions` row. Generating or
editing creates a new `DRAFT` version; approval promotes it and supersedes the old one.
`persona_evidence` records why each attribute has its value as a short derived summary — raw
imported text is never stored there.

**Compatibility cache invalidation.** A score row is unique on
`(persona_version_a_id, persona_version_b_id, weights_version, engine_version)`. When either
person approves a new persona version, lookups use the new id and miss, so stale rows are never
served; they disappear by cascade when the superseded version is purged. Changing weights or
engine logic changes the key the same way.

**Insufficient data.** `compatibility_scores.overall` is nullable and a CHECK forbids a number
when `sufficiency = 'INSUFFICIENT'`. The database cannot hold a confident-looking score built
on missing data.

**Persona generation state** lives on `personas` (`generation_status` — CHECK-constrained to
`idle | queued | generating | ready | failed` — plus `generation_failure_code` and
`generation_requested_at`). `persona_evidence.source_detail` names the assistant for
`ASSISTANT_REFLECTION` evidence.

**Embeddings.** `vyra_vector.persona_embeddings (persona_version_id, model, embedding
vector(768))` with an HNSW cosine index. It sits outside the Prisma-managed `public` schema
(see TECHNICAL_RESEARCH.md) and is accessed with parameterised raw SQL.

**Imports.** `ai_imports.raw_expires_at` is mandatory, and a CHECK guarantees that once
`raw_deleted_at` is set the storage key is gone. `failure_code` is a code, never content.

**Photo positions.** A partial unique index allows one live photo per `(user_id, position)`.
Reordering moves every photo to `position + 1000` and then to its final slot inside one
transaction, because that index is checked row by row. The six-photo limit is enforced by the
API.

**Account deletion** removes the profile, photos (rows and files), intentions, preferences,
interests, consents and sessions immediately and blanks the contact details and date of birth
on the `users` row, which stays as an anonymous tombstone so safety reports and moderation
history about that account survive.

**Location.** `user_profiles` stores coarse, rounded coordinates used only for distance
filtering.

**Soft deletion.** `users.deleted_at`, `user_photos.deleted_at` and `messages.deleted_at`.
Account deletion marks the user, revokes sessions immediately, then a job purges personal data
within the disclosed window.

## Retention (targets; enforced by jobs from Milestone 7 and 8)

| Data                          | Retention                                     |
| ----------------------------- | --------------------------------------------- |
| Raw import archives           | Deleted after processing, at most 24 hours    |
| OTP challenges                | 24 hours                                      |
| Expired or revoked sessions   | 30 days                                       |
| Deleted account personal data | Purged within 30 days                         |
| Discovery events              | 18 months, then aggregated                    |
| Audit logs and safety reports | Per legal requirement; reviewed before launch |

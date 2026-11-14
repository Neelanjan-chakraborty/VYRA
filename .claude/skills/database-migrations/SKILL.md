---
name: database-migrations
description: How to change the VYRA PostgreSQL schema safely with Prisma 7. Use when adding or altering models, constraints, indexes, pgvector tables, or when a migration or schema-drift check fails.
---

# Database migrations

Schema: `apps/api/prisma/schema.prisma`. Migrations: `apps/api/prisma/migrations`.
Config (datasource URL, paths): `apps/api/prisma.config.ts`. Run commands from `apps/api`.

## Workflow

1. Edit `schema.prisma`. Tables are `snake_case` via `@@map`, columns via `@map`; ids are UUIDs;
   timestamps are `@db.Timestamptz(3)`.
2. Create the migration **without applying it**:
   `pnpm prisma migrate dev --create-only --name <change>`
3. Open the generated SQL and add what Prisma cannot express, each with a comment:
   - `CHECK` constraints (ranges, ordered pairs `a_id < b_id`, "not self", consistency rules).
   - Partial unique indexes (`... WHERE deleted_at IS NULL`).
   - Data backfills needed before a `NOT NULL` or constraint.
4. Read every statement. A `DROP` or column type change on a table with data is destructive:
   stop and get it reviewed; prefer expand → backfill → contract across separate migrations.
5. Apply: `pnpm prisma migrate deploy`, then `pnpm prisma generate`.
6. Prove there is no drift (must exit 0):
   `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
7. Update `docs/DATABASE_SCHEMA.md` and add or extend an e2e test for new constraints.

## Rules

- Never edit a migration that has been applied anywhere shared. Add a new one.
- Do not run `prisma migrate dev` without `--create-only` in automation: on drift it waits for
  interactive input and hangs.
- `prisma migrate reset` destroys data. Only ever on a local database, and only when asked.
- pgvector lives in the separate `vyra_vector` schema, outside Prisma's view. Declaring a
  vector table in `schema.prisma` makes Prisma try to drop its HNSW index on every later
  migration. Change those tables with hand-written SQL in a migration and query them with
  `$queryRaw` / `$executeRaw` (parameterised — never string-concatenate input).
- Embedding dimension is fixed at 768. Changing it means a new column and a re-embed job.
- Every foreign key states its `onDelete`. User-owned rows cascade from `users`; rows that must
  outlive the user (reports, audit logs, messages) use `SetNull`.

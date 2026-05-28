# DB connection roles & env split

Phase 2a introduces RLS on every matter table. RLS is meaningless if the
runtime connects as the table owner (owners bypass RLS by default). This doc
captures the role grants and env wiring required for RLS to actually bind.

## 1. Create the runtime role (Sahil runs this in Supabase SQL editor)

Replace `<SAHIL_SETS_THIS>` with a strong password Sahil generates. Do NOT
commit the password anywhere; store it only in `.env.local`.

```sql
CREATE ROLE lawdger_app WITH LOGIN PASSWORD '<SAHIL_SETS_THIS>' NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO lawdger_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lawdger_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lawdger_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lawdger_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lawdger_app;
```

`NOBYPASSRLS` is explicit but redundant — only superusers and `BYPASSRLS`
roles bypass RLS, neither of which `lawdger_app` is. Keep the flag in the
DDL anyway, as a self-documenting safety belt.

## 2. Env split (Sahil edits `.env.local`)

| var            | role             | port | mode             | purpose                                  |
| -------------- | ---------------- | ---- | ---------------- | ---------------------------------------- |
| `DATABASE_URL` | `lawdger_app`    | 6543 | pooler (txn)     | runtime queries — RLS applies            |
| `DIRECT_URL`   | privileged owner | 5432 | direct           | migrations + seed — owner bypasses RLS   |

`DATABASE_URL` (runtime, RLS-bound):
```
postgresql://lawdger_app.<project-ref>:<password>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

`DIRECT_URL` (migrations only — keep as-is, owner role):
```
postgresql://postgres.<project-ref>:<owner-password>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```
or the dashboard's "direct" string on port 5432.

## 3. Why the split

- Supabase pooler at 6543 runs in PgBouncer **transaction mode** — prepared
  statements and some session-level state don't survive between queries.
  Add `?pgbouncer=true` so Prisma turns off named prepared statements.
- Migrations run DDL that PgBouncer can't safely pool — they go through
  `DIRECT_URL` (port 5432, no PgBouncer in the path).
- The owner role bypasses RLS as a Postgres-level privilege. Runtime MUST
  NOT use the owner, or the RLS policies created in
  `20260527051415_add_documents_litigation_rls` are silently no-ops.

## 4. Verification checklist (after Sahil flips the env)

- `psql "$DATABASE_URL" -c "SELECT current_user;"` → `lawdger_app`
- `psql "$DATABASE_URL" -c 'SELECT * FROM "Case";'` → `0 rows` (no GUC set →
  policy resolves to NULL → zero rows; this is the correct "fail-closed"
  behaviour).
- App login still works (auth runs through Prisma → `DATABASE_URL` →
  `lawdger_app`; queries that need data will start failing until Phase 2b
  ships the per-request GUC setter).

## 5. Out of scope (Phase 2b)

- Prisma client extension `forUser(userId)` that opens a connection, sets
  `app.current_user_id` via `SET LOCAL`, and returns a scoped client.
- `getPrismaForUser()` helper used by every API route / server action.
- Two-user isolation integration test.

Phase 2a stops at "policies exist, role exists, env is documented". Phase 2b
wires the runtime to actually use them.

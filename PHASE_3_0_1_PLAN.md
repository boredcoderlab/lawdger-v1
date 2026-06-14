# Phase 3.0.1 — Runtime RLS Enforcement Cutover Plan

## Status
- Authored: 2026-06-13
- Based on commit: main @ ad9fff9
- Author: Claude (Opus, planning) + Sahil (review)
- Predecessor: PHASE_3_2_5_PLAN.md (closed — all sub-PRs merged)

## Goal
Move the Lawdger app from structural-only RLS (postgres superuser bypasses every policy) to runtime-enforced RLS by:
1. Hardening the `lawdger_app` role (PASSWORD + table GRANTs + NOBYPASSRLS verified).
2. Applying `FORCE ROW LEVEL SECURITY` on all 7 protected tables.
3. Repointing the runtime `DATABASE_URL` from `postgres` to `lawdger_app`.
4. Authoring `auth_update_password` SECURITY DEFINER RPC.
5. Migrating `changePassword` from legacy contract to full 3.2 contract + RPC call.
6. Wiring `verify-isolation.ts`, `verify-phase32-rls.ts`, `verify-with-user-context.ts` as a blocking `smoke:rls-runtime` script.

After this phase, the pitch-deck "End-to-End Encrypted, Legal Grade" posture acquires its first real DB-layer backstop.

## Out of Scope (explicit)
- Voice pipeline (Phase 5)
- Legal Brain RAG (Phase 6)
- Chat route 500 bug (carried known-out; logged in §Discovered Debt)
- `seed.ts` upsert empty-update bug (carried known-out; logged in §Discovered Debt)
- `requireUserId.ts` deletion (deferred until taskActions migrates in 3.2.6)
- E2E encryption marketing claim reconciliation (separate decision)
- OAuth providers (pre-launch)
- Shadow DB stabilization (separate post-3.0.1 PR)

## Critical Environment Reality
**No staging Supabase branch exists.** Production project `mhgupsgjftbubnkuadge` (ap-northeast-1) is the only target. Cutover hits prod directly. Mitigations:
- Supabase Point-in-Time Recovery checkpoint taken immediately before each sub-PR's destructive step.
- Local `npm run smoke:rls-runtime` against `lawdger_app` role as blocking gate before any Vercel env swap.
- Cutover sequenced so app stays connecting as `postgres` until the very last sub-PR (3.0.1d). Pre-3.0.1d failures are recoverable without app downtime.

## Sub-phase Sequencing
| Sub-PR | Scope | Hits prod? | Reversible? |
|---|---|---|---|
| 3.0.1a | `lawdger_app` PASSWORD + table GRANTs + `ALTER ROLE … NOBYPASSRLS` re-assertion + FORCE RLS on 7 tables | Yes (DB migration) | Yes (drop GRANTs, unset PASSWORD, unset FORCE — app still on `postgres`) |
| 3.0.1b | `auth_update_password` RPC migration | Yes (DB migration) | Yes (DROP FUNCTION) |
| 3.0.1c | `changePassword` server action: legacy → full 3.2 contract + RPC call; `SettingsClient.tsx` password form: legacy `PasswordState` → `Result<T>` unwrap | No (TS only) | Yes (git revert) |
| 3.0.1d | `DATABASE_URL` repoint to `lawdger_app` (local `.env.local` + Vercel env) + `smoke:rls-runtime` wired into `npm run smoke` | Yes (env swap) | Yes but **app-affecting** (see §Rollback) |

Between every sub-PR: manual smoke + tsc + `npm run smoke` green before next PR opens. Sub-PRs land sequentially to `main`, not stacked.

## Locked Decisions
1. **Migration shape:** Split into 4 sub-PRs above (not single).
2. **Cutover gate:** Local `smoke:rls-runtime` against `lawdger_app` blocking before Vercel env swap. Staging branch not available — Supabase PITR checkpoint substitutes.
3. **`auth_update_password` contract:** App hashes plaintext via `bcryptjs` (cost 12, matching `auth_create_user` upstream pattern in `src/app/signup/actions.ts`). RPC accepts already-hashed string as `p_password text` and writes column. RPC does **not** hash. RPC does **not** verify old password — that happens in the action layer via `auth_find_user_by_email` + `bcrypt.compare`, mirroring the legacy `changePassword` shape.
4. **`smoke:rls-runtime` posture:** Blocking from day one, gated by `DATABASE_URL` pointing to `lawdger_app`. If running against `postgres`, script exits with a clear "skipping runtime checks — not connected as lawdger_app" advisory and returns 0. Effectively blocking post-3.0.1d, advisory pre-3.0.1d.
5. **Known-outs:** `chat-route 500` and `seed.ts upsert` out of scope, logged in §Discovered Debt.
6. **`lawdger_app` password handling:** Temporary password in committed migration + manual `ALTER ROLE lawdger_app PASSWORD '...'` post-apply, swapping to real password generated locally via `openssl rand -base64 32`. Real password lives only in `.env.local` and Vercel env. Migration uses a clearly-flagged temp value like `'CHANGE_ME_POST_APPLY'` documented in migration header.
7. **`DIRECT_URL` stays `postgres` in 3.0.1d.** Only `DATABASE_URL` (runtime app connection) swaps to `lawdger_app`. Prisma migrate continues to need superuser.

## `auth_update_password` RPC — Explicit Signature
Locking this in writing to prevent the 3.2.5a param-order drift:

```sql
CREATE OR REPLACE FUNCTION auth_update_password(
  p_email text,
  p_password text
)
RETURNS TABLE (
  id text,
  email text,
  "updatedAt" timestamp(3)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE "User"
  SET password = p_password,
      "updatedAt" = NOW()
  WHERE email = p_email
  RETURNING "User".id, "User".email, "User"."updatedAt";
END;
$$;
REVOKE ALL ON FUNCTION auth_update_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_update_password(text, text) TO lawdger_app;
GRANT EXECUTE ON FUNCTION auth_update_password(text, text) TO postgres;
```

**Param naming rationale:** `p_password` (not `p_password_hash`) matches `auth_create_user` shipped signature. The fact that it's a hash is enforced by the caller, not the param name. Documented in RPC comment header in the migration file.

**Empty-result handling:** If email doesn't exist, RPC returns 0 rows. Caller in `changePassword` must check `rows.length === 0` → return `{ ok: false, error: "User not found" }`. This is a state that should never happen in practice (session-authenticated user) but is checked for defence.

## Sub-PR Detail

### 3.0.1a — Role hardening + FORCE RLS
**Migration name:** `phase_3_0_1a_lawdger_app_grants_and_force_rls`

**Statement groups:**
1. `ALTER ROLE lawdger_app WITH LOGIN PASSWORD 'CHANGE_ME_POST_APPLY' NOBYPASSRLS;` — temporary password, LOGIN enabled, NOBYPASSRLS re-asserted (Supabase event-trigger guard pattern from 3.2.5a). Migration header documents the mandatory post-apply manual ALTER.
2. Per-table GRANTs to `lawdger_app`:
   - `GRANT USAGE ON SCHEMA public TO lawdger_app;`
   - `GRANT SELECT, INSERT, UPDATE, DELETE ON "User", "Case", "Note", "Task", "CalendarEvent", "Payment", "Document" TO lawdger_app;` — 7 app tables (`_prisma_migrations` stays postgres-only)
   - `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lawdger_app;` — if any cuid/serial; review actual schema first
3. `ALTER TABLE … FORCE ROW LEVEL SECURITY;` on all 7 protected tables (User + 6 app tables).
4. Verification block (DO block, raises NOTICE on each table's `relforcerowsecurity`).

**Post-apply manual step (mandatory, documented in PR body):**

```sql
ALTER ROLE lawdger_app PASSWORD '<value from .env.local LAWDGER_APP_DB_PASSWORD>';
```

Run via Supabase SQL editor as `postgres`. The temp password `'CHANGE_ME_POST_APPLY'` in the committed migration is intentionally non-functional shorthand; the real password never enters git.

**Rollback:** documented in migration header. `REVOKE ALL`, `ALTER ROLE lawdger_app NOLOGIN`, `ALTER TABLE … NO FORCE ROW LEVEL SECURITY`. Drop the password. App still on `postgres` so no runtime impact.

**Smoke after merge:** `npm run smoke` green. App still functional (postgres bypass active). `psql` as `lawdger_app` and verify a `SELECT * FROM "Case"` with no GUC set returns 0 rows.

### 3.0.1b — `auth_update_password` RPC
**Migration name:** `phase_3_0_1b_auth_update_password_rpc`

Single statement group: the function definition above, REVOKE + GRANTs.

**Rollback:** `DROP FUNCTION IF EXISTS auth_update_password(text, text);`

**Smoke after merge:** `npm run smoke` green. `psql` as postgres: `SELECT * FROM auth_update_password('nonexistent@x.com', 'fakehash');` returns 0 rows, no error.

### 3.0.1c — `changePassword` contract uplift
**No DB migration.**

**Files touched:**
- `src/actions/settingsActions.ts` — `changePassword` function rewrite
- `src/components/SettingsClient.tsx` — password form `useActionState` rewrap

**New `changePassword` contract:**
1. Replace `requireUserId` with `getServerSession`.
2. Authored `passwordChangeSchema` Zod: `{ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(72) }` (72 = bcrypt input ceiling).
3. Pull email from session (`session.user.email`).
4. Verify current password: `prisma.$queryRaw` → `auth_find_user_by_email(email)` → `bcrypt.compare(currentPassword, row.password)`. Use bare `prisma` (not scoped), because this is auth-path — same justification as 3.2.5a.
5. Hash new password: `bcrypt.hash(newPassword, 12)`.
6. Call RPC: `prisma.$queryRaw` → `auth_update_password(email, newHash)`.
7. Return `Result<{ message: string }>`.

**`SettingsClient.tsx` changes:**
- Drop `PasswordState` legacy type.
- Migrate password form to `useActionState<ActionResult, FormData>` (Option I, same as the other three settings forms shipped in 3.2.5b-ii).
- Inline validation surfacing via existing `bannerFromResult` helper.

**Result:** `requireUserId.ts` callers drop from 6 → 5. (Still imported by voice/transcribe, calendarActions, taskActions, dashboardActions, financeActions. Final delete waits for 3.2.6.)

**Smoke:** manual matrix — wrong current password → error banner; valid change → success banner; logout + login with new password → succeeds. tsc clean. `npm run smoke` green.

### 3.0.1d — `DATABASE_URL` repoint + smoke wiring

> **Scope correction (2026-06-14):** Vercel cutover is **deferred to
> Phase 9 (Platform + deploy)** per Lawdger_Production_Roadmap.md.
> 3.0.1d now covers local `.env.local` swap only. Steps 3.0 (Vercel
> env precondition), 3.5 (Vercel env swap), and 3.6 (Vercel redeploy +
> prod smoke) are removed from this phase. Phase 9 picks them up when
> production deployment begins.

**No DB migration.**

**Files touched:**
- `.env.example` — comment update only, document new role usage
- `package.json` — add `smoke:rls-runtime` script + chain into `smoke`
- `scripts/check-rls-runtime.ts` — new wrapper that runs `verify-isolation.ts`, `verify-phase32-rls.ts`, `verify-with-user-context.ts` in sequence, with the role-detection advisory described in locked decision #4
- `SOURCE_OF_TRUTH.md` — RLS posture table flipped from "structural only" to "runtime enforced"; pitch-deck claim section updated

**`.env.local` change (Sahil, manual):**

```
# OLD
DATABASE_URL="postgres://postgres:....@.../postgres"
# NEW
DATABASE_URL="postgres://lawdger_app:${LAWDGER_APP_DB_PASSWORD}@.../postgres"
```

`DIRECT_URL` stays as `postgres` (Prisma migrate needs superuser).

**Vercel env change (Sahil, manual):** mirror the above swap in Production env. Do **not** swap until local smoke green.

**Pre-swap sequence (mandatory):**
1. Local `.env.local` swapped.
2. `npm run smoke` — must include `smoke:rls-runtime` green.
3. Manual smoke: signup, login, settings save, password change, case create, case read (verify own-row only), logout.
4. **Supabase PITR checkpoint taken via dashboard.** Note timestamp.
5. Vercel env swapped.
6. Vercel redeploy.
7. Post-deploy smoke against production URL: login, list cases, settings load.

**Smoke after merge:** all of the above green.

## Rollback Plan

### 3.0.1a rollback
Revert migration via Prisma migrate or manual SQL from migration header. App on `postgres` throughout — no runtime impact during rollback.

### 3.0.1b rollback
`DROP FUNCTION`. No app impact (3.0.1c not yet shipped).

### 3.0.1c rollback
`git revert` the merge commit. `auth_update_password` RPC stays (harmless if unused). App reverts to legacy `changePassword`. No app downtime.

### 3.0.1d rollback — the only scary one

**Failure mode A — local smoke fails before Vercel swap:**
Revert `.env.local`. No production impact. Diagnose and re-attempt.

**Failure mode B — Vercel swap deployed, app broken in prod:**
1. Immediately revert Vercel `DATABASE_URL` to `postgres` value.
2. Redeploy.
3. App returns to working state (on `postgres`, RLS bypass active, but functional).
4. Root-cause offline.

**Failure mode C — data corruption suspected post-cutover:**
1. Trigger Supabase PITR restore to checkpoint timestamp from pre-swap step 4.
2. Revert Vercel env.
3. Redeploy.

**Documented revert sequence for 3.0.1d in PR body, copy-pasted into the merge commit body, and pinned in `SOURCE_OF_TRUTH.md` §Rollback.**

## Verification Matrix
| Check | Pre-3.0.1a | Post-3.0.1a | Post-3.0.1b | Post-3.0.1c | Post-3.0.1d |
|---|---|---|---|---|---|
| `tsc --noEmit` | green | green | green | green | green |
| `npm run smoke` (tsc+prisma+check-rls posture) | green | green | green | green | green |
| `lawdger_app` has LOGIN+PASSWORD | no | yes | yes | yes | yes |
| `lawdger_app` has table GRANTs | no | yes | yes | yes | yes |
| 7 tables FORCED RLS | no | yes | yes | yes | yes |
| `auth_update_password` exists | no | no | yes | yes | yes |
| `changePassword` on 3.2 contract | no | no | no | yes | yes |
| Runtime DB connection as `lawdger_app` | no | no | no | no | yes |
| `smoke:rls-runtime` blocking | n/a | advisory | advisory | advisory | blocking |
| User A cannot read User B rows (runtime test) | no (postgres bypass) | no (postgres bypass) | no (postgres bypass) | no (postgres bypass) | **yes** |

## Discovered Debt — Out of Scope
- `requireUserId.ts` deletion — waits for 3.2.6 (taskActions + voice/transcribe migration).
- `chat-route 500` — `type NoteCategory` re-export from a `"use server"` file. Separate post-3.0.1 PR.
- `seed.ts` upsert empty-update — prevents password refresh on re-seed. Separate post-3.0.1 PR.
- E2E encryption marketing reconciliation — product/marketing decision, not engineering.

## Risk Register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Forgotten table in GRANTs → app errors post-repoint | Med | High | Verification block in 3.0.1a migration enumerates all 7 tables; manual smoke against every page before 3.0.1d swap |
| `lawdger_app` password ends up committed | Low | Critical | Temp placeholder in migration + manual ALTER + secret only in `.env.local` and Vercel; gitleaks pre-commit if available |
| Supabase event trigger flips NOBYPASSRLS during deploy | Med | Critical | Idempotent ALTER assertion in 3.0.1a (3.2.5a precedent); verification block re-checks `rolbypassrls` after ALTER |
| `bcrypt.hash` cost mismatch between signup (cost 12) and password change | Low | Low | Explicit cost 12 in `changePassword`, matching `src/app/signup/actions.ts`; documented in PR body |
| Vercel env swap deployed but `DIRECT_URL` also swapped accidentally → Prisma migrate fails | Low | High | Explicit checklist item in 3.0.1d PR: `DIRECT_URL` stays as `postgres` |
| Connection pool size 5 insufficient under `lawdger_app` (each query transactional) | Low | Med | Already validated in 3.2.1; monitor post-cutover; bump to 10 if P2024 returns |
| Some `SELECT` in app code joins a table the user has GRANTs missing on | Low | High | Smoke matrix walks every page post-3.0.1d |

## Manual Smoke Checklist (post-3.0.1d)
1. Signup new user → succeeds, lands in dashboard
2. Login existing user → succeeds
3. Wrong password → error banner
4. Settings → load → profile fields populate
5. Settings → save profile name → success banner, persists on reload
6. Settings → change password → success banner; logout; login with new password → succeeds
7. Cases → create new matter → appears in list
8. Cases → list → only own matters visible (cross-user manual check via psql if needed)
9. Dashboard → loads with today's items
10. Logout → redirects to login

## Estimated CC Sessions
| Sub-PR | Sessions | Model |
|---|---|---|
| 3.0.1a | 1 | Opus (destructive migration) |
| 3.0.1b | 1 | Sonnet (single RPC) |
| 3.0.1c | 1 | Sonnet (TS contract uplift, mechanical) |
| 3.0.1d | 1 | Opus (cutover + script authoring + smoke wiring) |
| Total | 4 | |

-- =====================================================================
-- Migration:    phase_3_0_1a_lawdger_app_grants_and_force_rls
-- Timestamp:    20260612204242 UTC
-- Date:         2026-06-13
-- Phase:        3.0.1a (Runtime RLS Enforcement Cutover — sub-phase a)
-- Predecessor:  20260611142223_phase_3_2_5a_user_rls_and_auth_rpcs
-- Binding spec: PHASE_3_0_1_PLAN.md (main @ 39dfb13)
--
-- ---------------------------------------------------------------------
-- PURPOSE
-- ---------------------------------------------------------------------
-- Harden the `lawdger_app` role and force runtime RLS at the database
-- layer. This migration (a) promotes `lawdger_app` from NOLOGIN stub
-- to LOGIN with a deliberate placeholder password and re-asserts
-- every security-relevant role attribute postgres is permitted to set
-- (Supabase event-trigger guard pattern from 3.2.5a — attributes set
-- at CREATE ROLE time can be silently overridden, so we re-assert
-- after every change). NOSUPERUSER is deliberately NOT re-asserted in
-- the ALTER because Supabase's `postgres` role is not a real SUPERUSER
-- (rolsuper=false) and PG requires SUPERUSER to use the
-- SUPERUSER/NOSUPERUSER clause even as a no-op; defence shifts to the
-- §5a verification block which reads rolsuper and aborts if true. (b)
-- grants schema USAGE plus per-table SELECT/INSERT/UPDATE/DELETE on
-- the 7 application tables (User, Case, Note, Task, CalendarEvent,
-- Payment, Document), (c) applies FORCE ROW LEVEL SECURITY to those
-- same 7 tables so even a table owner cannot bypass policies, and (d)
-- verifies role attributes, per-table FORCE state, and per-table
-- GRANT presence via embedded DO blocks that abort the migration on
-- any deviation.
--
-- `_prisma_migrations` is deliberately excluded from both GRANTs and
-- FORCE — the migration runner connects as `postgres` (superuser) and
-- needs unrestricted access to its own bookkeeping table; the
-- application has no business reading or writing migration state.
--
-- The placeholder password `CHANGE_ME_POST_APPLY` is intentionally
-- non-functional. The real password is set by a manual ALTER ROLE
-- statement run by Sahil in the Supabase SQL editor immediately after
-- this migration applies (value sourced from .env.local
-- LAWDGER_APP_DB_PASSWORD; never committed to git).
--
-- The runtime app still connects as `postgres` after this migration.
-- The DATABASE_URL repoint to `lawdger_app` happens in sub-phase
-- 3.0.1d. So FORCE RLS does NOT affect the running app yet — but it
-- DOES make 3.0.1d's repoint the moment of truth: any missing GRANT
-- or missing policy will surface there. That gating is intentional.
--
-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- Run as `postgres` in the Supabase SQL editor, in this order. Each
-- group reverses the matching numbered group below.
--
--   -- Reverse §4: un-FORCE RLS (RLS itself stays ENABLED; only FORCE
--   --             is removed — keeps policies in effect for non-owner
--   --             roles, matches pre-3.0.1a posture)
--   ALTER TABLE "User"          NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "Case"          NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "Note"          NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "Task"          NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "CalendarEvent" NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "Payment"       NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "Document"      NO FORCE ROW LEVEL SECURITY;
--
--   -- Reverse §3: revoke per-table GRANTs
--   REVOKE SELECT, INSERT, UPDATE, DELETE
--     ON TABLE "User", "Case", "Note", "Task",
--              "CalendarEvent", "Payment", "Document"
--     FROM lawdger_app;
--
--   -- Reverse §2: revoke sequence/schema/connect
--   REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM lawdger_app;
--   REVOKE USAGE ON SCHEMA public FROM lawdger_app;
--   REVOKE CONNECT ON DATABASE postgres FROM lawdger_app;
--
--   -- Reverse §1: demote role back to NOLOGIN stub (3.2.5a posture).
--   --             PASSWORD NULL is required to fully clear the
--   --             placeholder / real password. NOSUPERUSER omitted
--   --             for the same reason as the forward migration —
--   --             postgres lacks SUPERUSER privilege to use that
--   --             clause; rolsuper stays false from creation default.
--   ALTER ROLE lawdger_app WITH NOLOGIN NOBYPASSRLS
--                               NOCREATEDB NOCREATEROLE PASSWORD NULL;
--
--   -- Finally, mark the migration rolled-back in Prisma's history:
--   --   npx prisma migrate resolve --rolled-back \
--   --     20260612204242_phase_3_0_1a_lawdger_app_grants_and_force_rls
--
-- ---------------------------------------------------------------------
-- MANUAL POST-APPLY STEP (mandatory — do NOT skip)
-- ---------------------------------------------------------------------
-- After this migration applies cleanly (every verification NOTICE
-- fires, zero EXCEPTION), run as a SEPARATE statement in the Supabase
-- SQL editor (same session is fine):
--
--   ALTER ROLE lawdger_app PASSWORD
--     '<value of LAWDGER_APP_DB_PASSWORD from .env.local>';
--
-- If `.env.local` does not yet have that variable, generate one
-- locally first:
--
--   openssl rand -base64 32 | tr -d '=+/' | head -c 40
--
-- Save the output as `LAWDGER_APP_DB_PASSWORD=...` in `.env.local`,
-- then run the ALTER above with that value. Mirror the same value to
-- Vercel environment (post-merge) so 3.0.1d's DATABASE_URL swap is a
-- one-step env change.
--
-- Until the manual ALTER runs, `lawdger_app` cannot actually log in
-- — the placeholder string is set as the role's authentication
-- secret but no client will ever be configured with it. The app
-- still connects as `postgres`, so the running app is unaffected.
-- =====================================================================


-- =====================================================================
-- 1. Role hardening (idempotent — ALTER, not CREATE)
-- =====================================================================
-- `lawdger_app` already exists from 3.2.5a as a NOLOGIN NOBYPASSRLS
-- stub owning nothing and holding no GRANTs. We promote it to LOGIN
-- with a placeholder password and explicitly re-assert every
-- security-relevant attribute.
--
-- Why every attribute is re-asserted in one ALTER:
--   - LOGIN ............ promotes from the NOLOGIN stub
--   - PASSWORD ......... non-NULL is required for LOGIN to authenticate
--                        at all; this placeholder is overwritten by
--                        Sahil's manual ALTER immediately post-apply
--   - NOBYPASSRLS ...... critical — without this the role would skip
--                        every RLS policy, defeating the entire phase.
--                        Postgres has BYPASSRLS itself, so it is
--                        permitted to grant/revoke this attribute on
--                        roles it admins.
--   - NOCREATEDB ....... no need; not an admin role. Postgres has
--                        CREATEDB so the clause is permitted.
--   - NOCREATEROLE ..... no need; not an admin role. Postgres has
--                        CREATEROLE so the clause is permitted.
--
-- Why NOSUPERUSER is deliberately NOT in this ALTER:
-- PG requires the actor itself to be SUPERUSER to use the
-- SUPERUSER/NOSUPERUSER clause in ALTER ROLE — even when the clause
-- would be a no-op (target already NOSUPERUSER). Supabase's `postgres`
-- role is not a real SUPERUSER (rolsuper=false); only `supabase_admin`
-- is, and `postgres` is not a member of `supabase_admin`. Including
-- NOSUPERUSER here fails with 42501 ("permission denied to alter
-- role"). Defence shifts to §5a's verification: it reads
-- `pg_roles.rolsuper` (no privilege needed) and aborts the migration
-- if true. lawdger_app was created without SUPERUSER and only a
-- SUPERUSER can grant SUPERUSER, so the creation-default NOSUPERUSER
-- state is stable absent explicit Supabase-internal intervention —
-- which the verification will catch if it ever happens.
--
-- Supabase event triggers have been observed (3.2.5a) to silently
-- flip role attributes set at CREATE ROLE time. The defence is to
-- re-assert via ALTER after any role-affecting change, which is what
-- this single statement does.
ALTER ROLE lawdger_app
  WITH LOGIN
       PASSWORD 'CHANGE_ME_POST_APPLY'
       NOBYPASSRLS
       NOCREATEDB
       NOCREATEROLE;


-- =====================================================================
-- 2. Schema + sequence USAGE + database CONNECT
-- =====================================================================
-- Without CONNECT on the database, the role cannot establish a
-- session even with LOGIN. Without USAGE on schema public, the role
-- cannot reference any object inside it. Sequence privileges are
-- granted defensively: the current Prisma schema uses cuid()/uuid()
-- text PKs (no sequences are touched by app writes today), but
-- granting now means future identity columns will not silently
-- break the role.
GRANT CONNECT ON DATABASE postgres TO lawdger_app;
GRANT USAGE ON SCHEMA public TO lawdger_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lawdger_app;


-- =====================================================================
-- 3. Per-table GRANTs (explicit — NOT `ALL TABLES`)
-- =====================================================================
-- Exactly 7 application tables, listed per-table on purpose. Using
-- explicit names (not `GRANT ... ON ALL TABLES IN SCHEMA public`)
-- forces every future model added to schema.prisma to ship with its
-- own explicit GRANT migration. This prevents accidental privilege
-- creep where a new table is silently exposed to the app role.
--
-- For the same reason this migration does NOT issue
-- `ALTER DEFAULT PRIVILEGES` — future tables stay locked-down by
-- default until their migration explicitly grants.
--
-- `_prisma_migrations` is deliberately omitted: the Prisma runner
-- connects as `postgres` (superuser) and needs unrestricted access
-- to its bookkeeping table; the app role has no business touching it.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "User"          TO lawdger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Case"          TO lawdger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Note"          TO lawdger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Task"          TO lawdger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "CalendarEvent" TO lawdger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Payment"       TO lawdger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Document"      TO lawdger_app;


-- =====================================================================
-- 4. FORCE ROW LEVEL SECURITY (same 7 tables)
-- =====================================================================
-- RLS is already ENABLED on all 7 tables by prior migrations:
--   - 20260527051415_add_documents_litigation_rls (Case, Note, Task,
--     CalendarEvent, Payment, Document)
--   - 20260609030200_enable_rls_user_and_migrations (User)
--
-- ENABLED RLS is bypassed by (a) the table owner and (b) any role
-- with BYPASSRLS. FORCE upgrades enforcement so that EVEN the table
-- owner is subject to policies. After this migration:
--   - postgres (table owner, BYPASSRLS) — still bypasses via the
--     BYPASSRLS attribute (default for the Supabase postgres role).
--     The app still connects as postgres until 3.0.1d, so the
--     application is unaffected by FORCE at this point.
--   - lawdger_app (NOBYPASSRLS) — fully subject to RLS at runtime
--     from now on. This is the gate for 3.0.1d's DATABASE_URL swap.
--
-- `_prisma_migrations` has RLS ENABLED (from migration
-- 20260609030200) but no policies and is left un-FORCED here. The
-- migration runner connects as `postgres` (BYPASSRLS attribute), so
-- it traverses regardless; `lawdger_app` cannot reach it because it
-- has no GRANTs on that table. Defence in depth: even if a GRANT
-- slipped in later, no policy = default deny for a non-bypass role.
ALTER TABLE "User"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "Case"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "Note"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "Task"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Payment"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "Document"      FORCE ROW LEVEL SECURITY;


-- =====================================================================
-- 5. Verification — assert role attrs, FORCE state, GRANT presence
-- =====================================================================
-- Three DO blocks. Each NOTICE is informational; each EXCEPTION
-- aborts the entire migration transaction. If any check fails,
-- NOTHING above this point commits.

-- ---------- 5a. Role attributes (5 checks) ----------
-- Spec mandates 3 (rolcanlogin, rolbypassrls, rolsuper). We also
-- verify the two NO* attributes we explicitly set in §1
-- (rolcreatedb, rolcreaterole) — if we set them, we verify them.
DO $$
DECLARE
  r RECORD;
BEGIN
  SELECT rolcanlogin, rolbypassrls, rolsuper, rolcreatedb, rolcreaterole
    INTO r
    FROM pg_roles
    WHERE rolname = 'lawdger_app';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification 5a: role lawdger_app does not exist';
  END IF;

  IF r.rolcanlogin IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'verification 5a: lawdger_app.rolcanlogin expected TRUE, got %', r.rolcanlogin;
  END IF;
  RAISE NOTICE 'verification 5a: lawdger_app.rolcanlogin = TRUE';

  IF r.rolbypassrls IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'verification 5a: lawdger_app.rolbypassrls expected FALSE, got %', r.rolbypassrls;
  END IF;
  RAISE NOTICE 'verification 5a: lawdger_app.rolbypassrls = FALSE';

  IF r.rolsuper IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'verification 5a: lawdger_app.rolsuper expected FALSE, got %', r.rolsuper;
  END IF;
  RAISE NOTICE 'verification 5a: lawdger_app.rolsuper = FALSE';

  IF r.rolcreatedb IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'verification 5a: lawdger_app.rolcreatedb expected FALSE, got %', r.rolcreatedb;
  END IF;
  RAISE NOTICE 'verification 5a: lawdger_app.rolcreatedb = FALSE';

  IF r.rolcreaterole IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'verification 5a: lawdger_app.rolcreaterole expected FALSE, got %', r.rolcreaterole;
  END IF;
  RAISE NOTICE 'verification 5a: lawdger_app.rolcreaterole = FALSE';
END $$;


-- ---------- 5b. FORCE ROW LEVEL SECURITY per table (7 checks) ----------
DO $$
DECLARE
  t      TEXT;
  forced BOOLEAN;
  tables TEXT[] := ARRAY['User','Case','Note','Task','CalendarEvent','Payment','Document'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    SELECT c.relforcerowsecurity
      INTO forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'verification 5b: table public.% does not exist', t;
    END IF;

    IF forced IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'verification 5b: table public.% expected relforcerowsecurity=TRUE, got %', t, forced;
    END IF;

    RAISE NOTICE 'verification 5b: public.% FORCE ROW LEVEL SECURITY = TRUE', t;
  END LOOP;
END $$;


-- ---------- 5c. GRANT presence per table per privilege (7 × 4 = 28 checks) ----------
DO $$
DECLARE
  t      TEXT;
  p      TEXT;
  cnt    INT;
  tables TEXT[] := ARRAY['User','Case','Note','Task','CalendarEvent','Payment','Document'];
  privs  TEXT[] := ARRAY['SELECT','INSERT','UPDATE','DELETE'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOREACH p IN ARRAY privs LOOP
      SELECT COUNT(*)
        INTO cnt
        FROM information_schema.role_table_grants
        WHERE grantee       = 'lawdger_app'
          AND table_schema  = 'public'
          AND table_name    = t
          AND privilege_type = p;

      IF cnt = 0 THEN
        RAISE EXCEPTION 'verification 5c: lawdger_app missing % on public.%', p, t;
      END IF;
    END LOOP;
    RAISE NOTICE 'verification 5c: lawdger_app has SELECT/INSERT/UPDATE/DELETE on public.%', t;
  END LOOP;
END $$;

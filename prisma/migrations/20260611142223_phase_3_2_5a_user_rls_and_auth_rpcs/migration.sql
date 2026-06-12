-- Migration: phase_3_2_5a_user_rls_and_auth_rpcs
-- Date: 2026-06-11 14:22:23 UTC
-- Purpose: Auth-path RLS RPCs + User owner-keyed policies + lawdger_app NOLOGIN stub
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.auth_create_user(text, text, text);
--   DROP FUNCTION IF EXISTS public.auth_find_user_by_email(text);
--   DROP POLICY IF EXISTS "User_self_select" ON "User";
--   DROP POLICY IF EXISTS "User_self_update" ON "User";
--   DROP ROLE IF EXISTS lawdger_app;  -- safe: NOLOGIN, owns nothing, no GRANTs
--   npx prisma migrate resolve --rolled-back 20260611142223_phase_3_2_5a_user_rls_and_auth_rpcs

-- =====================================================
-- 1. lawdger_app NOLOGIN NOBYPASSRLS stub role
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lawdger_app') THEN
    CREATE ROLE lawdger_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- Idempotent assertion: some Supabase projects ship roles pre-created
-- with LOGIN enabled by event triggers. Force NOLOGIN explicitly so the
-- stub cannot authenticate until 3.0.1 sets a password + repoints
-- DATABASE_URL.
ALTER ROLE lawdger_app NOLOGIN NOBYPASSRLS;

-- =====================================================
-- 2. User table owner-keyed RLS policies (NULLIF-guarded)
-- =====================================================
-- RLS already enabled on User via 20260609030200_enable_rls_user_and_migrations.
-- Pattern matches 7-table convention from 20260527051415_add_documents_litigation_rls.

CREATE POLICY "User_self_select" ON "User"
  FOR SELECT
  USING ("id" = NULLIF(current_setting('app.current_user_id', true), '')::text);

CREATE POLICY "User_self_update" ON "User"
  FOR UPDATE
  USING ("id" = NULLIF(current_setting('app.current_user_id', true), '')::text)
  WITH CHECK ("id" = NULLIF(current_setting('app.current_user_id', true), '')::text);

-- =====================================================
-- 3. auth_find_user_by_email — 4-col surface (id, email, name, password)
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_find_user_by_email(p_email text)
  RETURNS TABLE (
    id       text,
    email    text,
    name     text,
    password text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.email, u.name, u."password"
  FROM "User" u
  WHERE u.email = p_email
  LIMIT 1;
$$;

ALTER FUNCTION public.auth_find_user_by_email(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.auth_find_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_find_user_by_email(text) TO lawdger_app;
GRANT EXECUTE ON FUNCTION public.auth_find_user_by_email(text) TO postgres;

-- =====================================================
-- 4. auth_create_user — RETURNS TABLE with full row (minus password)
-- =====================================================
CREATE OR REPLACE FUNCTION public.auth_create_user(
  p_email    text,
  p_password text,
  p_name     text
)
  RETURNS TABLE (
    id          text,
    email       text,
    name        text,
    "createdAt" timestamp(3),
    "updatedAt" timestamp(3)
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;
  IF p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'password required';
  END IF;

  v_id := gen_random_uuid()::text;

  RETURN QUERY
  INSERT INTO "User" (id, email, "password", name, "updatedAt")
  VALUES (v_id, p_email, p_password, p_name, now())
  RETURNING "User".id, "User".email, "User".name, "User"."createdAt", "User"."updatedAt";

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS' USING ERRCODE = '23505';
END;
$$;

ALTER FUNCTION public.auth_create_user(text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.auth_create_user(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_create_user(text, text, text) TO lawdger_app;
GRANT EXECUTE ON FUNCTION public.auth_create_user(text, text, text) TO postgres;

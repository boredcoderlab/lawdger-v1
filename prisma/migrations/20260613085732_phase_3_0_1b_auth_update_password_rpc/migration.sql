-- =====================================================
-- Migration: 20260613085732_phase_3_0_1b_auth_update_password_rpc
-- Phase:     3.0.1b
-- Predecessor: 20260612204242_phase_3_0_1a_lawdger_app_grants_and_force_rls
-- Spec ref:  PHASE_3_0_1_PLAN.md § "auth_update_password RPC — Explicit Signature"
--
-- PURPOSE:
--   Adds auth_update_password(p_email text, p_password text) as the third
--   SECURITY DEFINER RPC in the auth-path trio alongside auth_find_user_by_email
--   and auth_create_user (both shipped in 3.2.5a). Together the three RPCs cover
--   the full auth surface: locate a user for credential checking, create a new
--   user, and update a user's password. This completes the trio. The RPC is
--   reachable after this migration but is not consumed until 3.0.1c migrates the
--   changePassword server action to call it; the active app still goes through
--   Prisma for password updates until then.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.auth_update_password(text, text);
--   Then: npx prisma migrate resolve --rolled-back 20260613085732_phase_3_0_1b_auth_update_password_rpc
--
-- NOTE:
--   No manual post-apply step needed (unlike 3.0.1a which required GRANTs on
--   existing tables). This migration is self-contained — the verification DO
--   block at the end confirms everything is wired correctly.
-- =====================================================


-- =====================================================
-- 1. auth_update_password — RETURNS TABLE (id, email, updatedAt)
-- =====================================================
--
-- Caller contract (enforced by the 3.0.1c action layer, not here):
--   - p_password is a bcrypt hash (cost 12) produced by the caller before
--     invoking this RPC. The RPC writes the hash verbatim; it does not hash.
--   - The caller is responsible for verifying the old password before calling.
--     This RPC performs no credential verification — pure UPDATE … RETURNING.
--   - If p_email does not match any User row, the RPC returns 0 rows (no error).
--     The caller checks rows.length === 0 and surfaces a user-not-found result.
--
CREATE OR REPLACE FUNCTION public.auth_update_password(
  p_email    text,
  p_password text
)
  RETURNS TABLE (
    id          text,
    email       text,
    "updatedAt" timestamp(3)
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE "User"
  SET    password    = p_password,
         "updatedAt" = NOW()
  WHERE  "User".email = p_email
  RETURNING "User".id, "User".email, "User"."updatedAt";
END;
$$;


-- =====================================================
-- 2. Ownership, REVOKE, GRANTs — mirrors 3.2.5a exactly
-- =====================================================
ALTER FUNCTION public.auth_update_password(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.auth_update_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_update_password(text, text) TO lawdger_app;
GRANT EXECUTE ON FUNCTION public.auth_update_password(text, text) TO postgres;


-- =====================================================
-- 3. Verification DO block
-- =====================================================
DO $$
DECLARE
  v_func_oid    oid;
  v_prosecdef   bool;
  v_proargtypes text;
  v_owner       text;
  v_lawdger_ok  bool := false;
  v_postgres_ok bool := false;
  r             record;
BEGIN
  -- 3a. Function exists, is SECURITY DEFINER, and has correct arg types
  SELECT p.oid, p.prosecdef, pg_catalog.pg_get_function_arguments(p.oid)
    INTO v_func_oid, v_prosecdef, v_proargtypes
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'auth_update_password';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFY FAIL: function public.auth_update_password not found';
  END IF;
  RAISE NOTICE 'VERIFY OK: function public.auth_update_password exists (oid=%)', v_func_oid;

  IF NOT v_prosecdef THEN
    RAISE EXCEPTION 'VERIFY FAIL: prosecdef is false — function is not SECURITY DEFINER';
  END IF;
  RAISE NOTICE 'VERIFY OK: prosecdef = true (SECURITY DEFINER confirmed)';

  IF v_proargtypes NOT LIKE '%text%text%' THEN
    RAISE EXCEPTION 'VERIFY FAIL: unexpected arg types: %', v_proargtypes;
  END IF;
  RAISE NOTICE 'VERIFY OK: arg types = %', v_proargtypes;

  -- 3b. Owner is postgres
  SELECT rol.rolname
    INTO v_owner
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_roles rol ON rol.oid = p.proowner
   WHERE p.oid = v_func_oid;

  IF v_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY FAIL: owner is %, expected postgres', v_owner;
  END IF;
  RAISE NOTICE 'VERIFY OK: owner = postgres';

  -- 3c. EXECUTE grants present for lawdger_app and postgres
  FOR r IN
    SELECT grantee
      FROM information_schema.role_routine_grants
     WHERE routine_schema = 'public'
       AND routine_name   = 'auth_update_password'
       AND privilege_type = 'EXECUTE'
  LOOP
    IF r.grantee = 'lawdger_app' THEN v_lawdger_ok  := true; END IF;
    IF r.grantee = 'postgres'    THEN v_postgres_ok := true; END IF;
  END LOOP;

  IF NOT v_lawdger_ok THEN
    RAISE EXCEPTION 'VERIFY FAIL: EXECUTE not granted to lawdger_app';
  END IF;
  RAISE NOTICE 'VERIFY OK: EXECUTE granted to lawdger_app';

  IF NOT v_postgres_ok THEN
    RAISE EXCEPTION 'VERIFY FAIL: EXECUTE not granted to postgres';
  END IF;
  RAISE NOTICE 'VERIFY OK: EXECUTE granted to postgres';

  RAISE NOTICE 'VERIFY COMPLETE: all assertions passed for public.auth_update_password';
END;
$$;

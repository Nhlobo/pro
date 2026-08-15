-- External Portal — fix "Sign Out" redirecting to the internal staff
-- /auth page instead of /external-portal/sign-in for referring attorneys
-- and medical experts.
--
-- ROOT CAUSE
-- ----------
-- supabase/functions/external-portal-auth/index.ts (bridgeToSupabaseAuth)
-- upserts a profiles row on every external-portal login:
--
--   await supabaseAdmin.from("profiles").upsert({
--     ...
--     role,                          -- 'referring_attorney' | 'medical_expert'
--     user_type: "external_portal",
--     is_external_portal_user: true,
--     ...
--   });
--
-- Three of those values were never valid against the schema that existed
-- before this migration:
--   1. profiles.is_external_portal_user did not exist as a column at all.
--   2. profiles_role_check only allowed
--      ('admin','user','employee','sales_consultant') — not
--      'referring_attorney' / 'medical_expert'.
--   3. The inline CHECK on user_type only allowed
--      ('admin','employee','referring_attorney','user') — not
--      'external_portal'.
--
-- The upsert's returned `error` is never checked in that function, so this
-- failed silently on *every* external-portal login: the shadow profile
-- kept whatever role/user_type it had from creation and was never actually
-- flagged as an external-portal account.
--
-- Client-side, src/hooks/useAuth.tsx reads that same flag right after
-- sign-in and caches it (src/utils/externalPortalSession.ts,
-- markExternalPortalSession) so that signOut() has a synchronous answer to
-- "should this person land on /external-portal/sign-in or /auth?" — see
-- postSignOutPath(). Because the column never existed, that read always
-- came back empty, the cache was always "not an external session", and
-- postSignOutPath() always resolved to the internal STAFF_SIGN_IN_PATH
-- ('/auth'). That's the bug being reported: attorneys/experts tapping
-- Sign Out inside their portal were dropped on the staff login page.
--
-- This migration makes the schema match what the edge function has been
-- trying to write all along, and backfills existing shadow accounts so
-- affected users are fixed immediately rather than only on next login.

-- 1. Add the missing column the frontend keys its redirect decision on.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_external_portal_user boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_external_portal_user IS
  'True for shadow accounts provisioned by external-portal-auth (referring attorneys / medical experts who sign in via emailed link + OTP, not staff password/passkey login). Read by useAuth right after sign-in and cached via markExternalPortalSession() so signOut() can send them back to /external-portal/sign-in instead of the internal /auth page — see src/utils/externalPortalSession.ts.';

CREATE INDEX IF NOT EXISTS idx_profiles_is_external_portal_user
  ON public.profiles (is_external_portal_user);

-- 2. Widen profiles.role to allow the portal role values
--    external-portal-auth actually assigns (PORTAL_ROLE in
--    supabase/functions/external-portal-auth/index.ts).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user', 'employee', 'sales_consultant', 'referring_attorney', 'medical_expert'));

-- 3. Widen profiles.user_type the same way. This CHECK was added inline
--    with the column back in 20250915142308 without an explicit name, so
--    Postgres gave it the default "<table>_<column>_check" name.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('admin', 'employee', 'referring_attorney', 'user', 'external_portal'));

-- 4. Backfill shadow profiles created before this fix, so anyone whose
--    account was silently mis-tagged is corrected now instead of waiting
--    on their next login. user_roles is authoritative here — that upsert
--    (a separate table, unaffected by the CHECK/column issues above) has
--    been succeeding all along.
UPDATE public.profiles p
SET is_external_portal_user = true
FROM public.user_roles ur
WHERE ur.user_id = p.id
  AND ur.role IN ('referring_attorney', 'medical_expert')
  AND p.is_external_portal_user IS DISTINCT FROM true;

-- 5. Close the same self-escalation gap the staff deactivation migration
--    (20260728120000) already closed for role/user_type/is_active/etc.:
--    a signed-in user should not be able to flip their own
--    is_external_portal_user flag (it only drives a client-side routing
--    decision, but it should still only ever be set by the service-role
--    edge function, same as the columns it sits next to).
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND user_type IS NOT DISTINCT FROM (SELECT user_type FROM public.profiles WHERE id = auth.uid())
  AND referring_attorney_id IS NOT DISTINCT FROM (SELECT referring_attorney_id FROM public.profiles WHERE id = auth.uid())
  AND is_active IS NOT DISTINCT FROM (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  AND deactivated_at IS NOT DISTINCT FROM (SELECT deactivated_at FROM public.profiles WHERE id = auth.uid())
  AND deactivated_by IS NOT DISTINCT FROM (SELECT deactivated_by FROM public.profiles WHERE id = auth.uid())
  AND deactivation_reason IS NOT DISTINCT FROM (SELECT deactivation_reason FROM public.profiles WHERE id = auth.uid())
  AND last_login_at IS NOT DISTINCT FROM (SELECT last_login_at FROM public.profiles WHERE id = auth.uid())
  AND is_external_portal_user IS NOT DISTINCT FROM (SELECT is_external_portal_user FROM public.profiles WHERE id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_system_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.referring_attorney_id IS DISTINCT FROM OLD.referring_attorney_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
     OR NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
     OR NEW.deactivation_reason IS DISTINCT FROM OLD.deactivation_reason
     OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
     OR NEW.is_external_portal_user IS DISTINCT FROM OLD.is_external_portal_user THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

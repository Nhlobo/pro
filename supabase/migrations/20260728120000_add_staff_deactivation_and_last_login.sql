-- Internal staff deactivation + last-login tracking.
--
-- Client ask: (1) be able to tell whether an employee is inactive and when
-- they last used the system, (2) deactivate a departed employee's account
-- instead of deleting it.
--
-- This mirrors the is_active / deactivated_at / deactivation_reason pattern
-- already used by public.attorney_access_codes and public.expert_access_codes
-- (see e.g. 20260123202507_*.sql, 20260324191346_*.sql) and applies the same
-- shape to public.profiles, rather than inventing a new convention.
-- "Deactivate Users" and "View User Activity" are also already reserved as
-- permission labels in useFunctionPermissions.tsx, confirming this was
-- anticipated but never wired up.

-- 1. New columns. ADD COLUMN IF NOT EXISTS so this is safe to run even if a
--    prior migration already partially introduced one of these.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

COMMENT ON COLUMN public.profiles.is_active IS
  'False = account deactivated by an admin (offboarded employee etc.) instead of deleted. Enforced at the auth layer via a Supabase ban (see deactivate-user edge function), not just this flag.';
COMMENT ON COLUMN public.profiles.last_login_at IS
  'Mirrors auth.users.last_sign_in_at (kept in sync by the on_auth_user_login trigger) so admins can see last-used-system time via the normal RLS-protected profiles read, without needing service-role access to auth.users.';

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- 2. One-time backfill so existing accounts show correct history immediately
--    instead of everyone reading NULL until their next login.
UPDATE public.profiles p
SET last_login_at = u.last_sign_in_at
FROM auth.users u
WHERE u.id = p.id
  AND u.last_sign_in_at IS NOT NULL
  AND p.last_login_at IS NULL;

-- 3. Keep last_login_at in sync going forward. Supabase Auth already
--    maintains auth.users.last_sign_in_at natively on every successful
--    sign-in (password, OTP, magic link, OAuth, passkey — all of it), so we
--    mirror that value onto the profile row rather than re-implementing
--    login tracking ourselves. profiles is already reachable through normal
--    RLS-protected reads, auth.users is not.
CREATE OR REPLACE FUNCTION public.sync_profile_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = NEW.last_sign_in_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
EXECUTE FUNCTION public.sync_profile_last_login();

-- 4. Close a self-reactivation gap. "Users can update own profile" (see
--    20260510201122_*.sql) already locks role/user_type/referring_attorney_id
--    against self-editing so a user can't escalate their own privileges from
--    a still-live session — extend that same lock to the new columns so a
--    user can't flip is_active back on (or blank out deactivated_at /
--    deactivation_reason / last_login_at) themselves. Admins are unaffected:
--    they operate through the separate "System admins full access to
--    profiles" FOR ALL policy, which this does not touch.
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
);

-- 5. Same lock, defense-in-depth, on the trigger-based safety net that backs
--    the policy above (see 20260510201122_*.sql). Also teaches it that a
--    NULL auth.uid() means there is no end-user session attached at all —
--    e.g. our own sync_profile_last_login trigger firing off an auth.users
--    update, or a service-role call that has already performed its own
--    authorization check upstream (deactivate-user does, before it ever
--    touches this table). The only way to reach this trigger with a NULL
--    auth.uid() is the service_role key, which already bypasses RLS
--    entirely, so this does not open any new path for an authenticated
--    non-admin to slip a privileged change through.
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
     OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Lightweight self-service check used by the frontend (usePermissions)
--    to sign out an already-open session promptly if the account gets
--    deactivated mid-session, rather than waiting for the hourly token
--    refresh to hit the auth-layer ban. SECURITY DEFINER + narrow return
--    (just the boolean) so a user can check their own status without any
--    broader grant on profiles.
CREATE OR REPLACE FUNCTION public.get_current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_active FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_user_is_active() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_is_active() TO authenticated;

-- External Portal — DB-level guarantee that an external-portal account
-- (referring attorney / medical expert signing in via emailed link + OTP)
-- can never be saved with an internal-staff role.
--
-- This is defense-in-depth, not a fix for a currently-reachable bug:
--   * is_system_admin() and is_admin_or_employee() already only ever grant
--     staff-level access based on user_roles.role IN ('admin','employee')
--     / profiles.role IN ('admin','employee') / profiles.user_type IN
--     ('admin','staff','super_user','employee') — none of which
--     external-portal-auth's bridgeToSupabaseAuth() ever writes (it only
--     ever writes role IN ('referring_attorney','medical_expert') and
--     user_type = 'external_portal').
--   * getAllUsers() (src/hooks/usePermissions.tsx) already excludes
--     user_type = 'external_portal' from the staff User Management list,
--     so an admin can't accidentally promote one of these shadow accounts
--     through that screen either.
--
-- What was missing was a hard guarantee at the schema level, so that a
-- future bug, a manual `UPDATE profiles ...`, or any other write path
-- can't ever leave an is_external_portal_user = true row holding an
-- admin/employee role — instead of relying on every call site upstream
-- continuing to get this right forever.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_external_portal_not_staff_chk
  CHECK (
    NOT (
      is_external_portal_user
      AND (role IN ('admin', 'employee') OR user_type IN ('admin', 'employee', 'staff', 'super_user'))
    )
  );

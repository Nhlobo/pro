-- External Portal — Phase 24: correct staff accounts stuck with a stale
-- is_external_portal_user = true, which sends them to the External Portal
-- sign-in page on every sign-out instead of the internal staff /auth page.
--
-- ROOT CAUSE
-- ----------
-- src/hooks/usePermissions.tsx's updateUserRole() (the admin "Change Role"
-- action) has always: (1) deleted the user's existing user_roles row(s) and
-- inserted one for the new role, then (2) tried to sync profiles.role to
-- match. It never touched profiles.is_external_portal_user.
--
-- That flag is what the client caches right after sign-in (see
-- src/utils/externalPortalSession.ts / markExternalPortalSession) so
-- sign-out has a synchronous answer to "internal /auth or
-- /external-portal/sign-in?". It's also guarded by a CHECK constraint,
-- profiles_external_portal_not_staff_chk (Phase 7), which forbids
-- is_external_portal_user = true together with an admin/employee role.
--
-- So whenever an admin used that screen to convert a referring-attorney or
-- medical-expert account into internal staff (role -> 'admin', 'employee',
-- 'sales_consultant', 'finance', or 'director'):
--   - user_roles was updated correctly to the new staff role. That table is
--     authoritative for get_current_user_role()/isAdmin(), so the person
--     correctly gets full staff access and functions as staff everywhere.
--   - The accompanying profiles.role update in the SAME action, however,
--     violated the Phase 7 CHECK constraint (is_external_portal_user was
--     still true from their original external-portal login) and failed —
--     silently: the code only logs a console.warn, it never surfaces or
--     retries this.
--   - profiles.is_external_portal_user was therefore left at `true`
--     forever, with nothing else in the app ever clearing it.
--
-- Net effect: a person who is now, functionally, genuine internal staff
-- still has is_external_portal_user = true sitting in their profile row,
-- so every sign-out sends them to the External Portal sign-in page instead
-- of /auth — reproducing on every device, every sign-out, indefinitely
-- (not a timing/browser-tab issue, hence identical behaviour on an
-- installed app).
--
-- The code path is fixed separately (updateUserRole now sets
-- is_external_portal_user in the same update as role, so this can't
-- recur through that screen). This migration is the one-time backfill
-- for accounts the bug already produced.
--
-- SCOPE / SAFETY
-- --------------
-- Only touches profiles that are BOTH:
--   (a) currently flagged is_external_portal_user = true, AND
--   (b) hold a user_roles row for an unambiguous internal-staff role
--       ('admin', 'employee', 'sales_consultant', 'finance', 'director') —
--       the exact same role set get_current_user_role() ranks above
--       'referring_attorney'/'medical_expert', so if a row like this
--       exists, that person is already being treated as staff everywhere
--       else in the app.
-- A profile whose only user_roles entry is 'referring_attorney' or
-- 'medical_expert' — i.e. every genuine, unconverted External Portal
-- account — matches neither condition and is completely untouched by
-- this migration.
UPDATE public.profiles p
SET is_external_portal_user = false
WHERE p.is_external_portal_user = true
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('admin', 'employee', 'sales_consultant', 'finance', 'director')
  );

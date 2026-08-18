-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 11
-- Enables the Messages feature end-to-end for both bridged portal
-- users (Referring Attorney + Medical Expert), and gives the Attorney
-- Portal Profile page a safe self-service email-change path.
--
-- CONTEXT / WHY THIS DIFFERS FROM PHASE 5'S ORIGINAL PLAN
-- ---------------------------------------------------------------------
-- Phase 5's comment on external_portal_case_messages assumed a
-- not-yet-built "external-portal-messages" edge function validating a
-- custom session_token — that was Phase 1's original design, before
-- the module pivoted (Phase 2/6) to bridging portal logins into real
-- Supabase Auth sessions via magiclink. That edge function was never
-- built; the pivot made it unnecessary. Every other table this module
-- reads (appointments, expert_reports, documents, etc.) already grants
-- the bridged session direct RLS access keyed off
-- profiles.referring_attorney_id / profiles.expert_id — see
-- get_current_user_referring_attorney() / get_current_user_expert_id(),
-- both pre-existing. This migration gives external_portal_case_links
-- and external_portal_case_messages the same treatment, for
-- consistency with the architecture that's actually live, rather than
-- building a second, parallel access-control mechanism.
--
-- SAFE TO RUN: purely additive. No existing policy, column, or table
-- is altered or dropped. Admin-only access to these two tables
-- (added in Phase 1 / Phase 5) is untouched — these are NEW policies
-- alongside it, scoped only to the bridged portal user's own account.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Resolve "my external_portal_accounts row" for the signed-in
--    bridged session. Single source of truth for both the RLS
--    policies below and the frontend (called via RPC once per portal
--    session, not re-derived ad hoc on every page).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_current_user_external_portal_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT epa.id
  FROM public.external_portal_accounts epa
  WHERE epa.deleted_at IS NULL
    AND (
      (epa.portal_type = 'attorney'
        AND public.get_current_user_referring_attorney() IS NOT NULL
        AND epa.referring_attorney_id = public.get_current_user_referring_attorney())
      OR
      (epa.portal_type = 'expert'
        AND public.get_current_user_expert_id() IS NOT NULL
        AND epa.medical_expert_id = public.get_current_user_expert_id())
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_external_portal_account_id() TO authenticated;
REVOKE ALL ON FUNCTION public.get_current_user_external_portal_account_id() FROM anon;

-- ---------------------------------------------------------------------
-- 2. external_portal_case_links — portal user can see which of their
--    cases are message-enabled (non-revoked links only). Admin policy
--    from Phase 1 is untouched; this is additive.
-- ---------------------------------------------------------------------

CREATE POLICY "Portal users view own case links"
  ON public.external_portal_case_links FOR SELECT
  USING (account_id = public.get_current_user_external_portal_account_id());

GRANT SELECT ON public.external_portal_case_links TO authenticated;

-- ---------------------------------------------------------------------
-- 3. external_portal_case_messages — portal user can read/send
--    messages for cases actually linked (non-revoked) to their own
--    account, and mark admin messages as read. Admin policy from
--    Phase 5 is untouched; these are additive.
-- ---------------------------------------------------------------------

CREATE POLICY "Portal users view own case messages"
  ON public.external_portal_case_messages FOR SELECT
  USING (
    account_id = public.get_current_user_external_portal_account_id()
    AND EXISTS (
      SELECT 1 FROM public.external_portal_case_links l
      WHERE l.account_id = external_portal_case_messages.account_id
        AND l.appointment_id = external_portal_case_messages.appointment_id
        AND l.revoked_at IS NULL
    )
  );

CREATE POLICY "Portal users send own case messages"
  ON public.external_portal_case_messages FOR INSERT
  WITH CHECK (
    sender_type = 'external_user'
    AND sender_staff_id IS NULL
    AND account_id = public.get_current_user_external_portal_account_id()
    AND EXISTS (
      SELECT 1 FROM public.external_portal_case_links l
      WHERE l.account_id = external_portal_case_messages.account_id
        AND l.appointment_id = external_portal_case_messages.appointment_id
        AND l.revoked_at IS NULL
    )
  );

CREATE POLICY "Portal users mark case messages read"
  ON public.external_portal_case_messages FOR UPDATE
  USING (account_id = public.get_current_user_external_portal_account_id())
  WITH CHECK (account_id = public.get_current_user_external_portal_account_id());

-- A portal user's UPDATE must only ever change read_by_external_at —
-- RLS's WITH CHECK can't compare against the pre-update row, so this
-- is enforced with a trigger, same pattern as
-- prevent_profile_privilege_escalation() elsewhere in this codebase.
-- Admins (has_role = 'admin') are exempt — they may edit freely via
-- their own separate policy.
CREATE OR REPLACE FUNCTION public.external_portal_case_messages_guard_external_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body
     OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
     OR NEW.sender_staff_id IS DISTINCT FROM OLD.sender_staff_id
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.read_by_admin_at IS DISTINCT FROM OLD.read_by_admin_at THEN
    RAISE EXCEPTION 'Portal users may only mark their own messages as read';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS external_portal_case_messages_guard_external_update ON public.external_portal_case_messages;
CREATE TRIGGER external_portal_case_messages_guard_external_update
  BEFORE UPDATE ON public.external_portal_case_messages
  FOR EACH ROW EXECUTE FUNCTION public.external_portal_case_messages_guard_external_update();

GRANT SELECT, INSERT, UPDATE ON public.external_portal_case_messages TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Unread-message counts for both dashboards — a single cheap RPC
--    rather than each dashboard hand-rolling the same join.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.external_portal_unread_message_count()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.external_portal_case_messages m
  JOIN public.external_portal_case_links l
    ON l.account_id = m.account_id AND l.appointment_id = m.appointment_id
  WHERE m.account_id = public.get_current_user_external_portal_account_id()
    AND m.sender_type = 'admin'
    AND m.read_by_external_at IS NULL
    AND l.revoked_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.external_portal_unread_message_count() TO authenticated;
REVOKE ALL ON FUNCTION public.external_portal_unread_message_count() FROM anon;

COMMENT ON FUNCTION public.get_current_user_external_portal_account_id() IS
  'Phase 11: resolves the external_portal_accounts row for the currently bridged portal session (attorney or expert), via the same profiles.referring_attorney_id/expert_id linkage every other RLS policy in this module already uses. Returns NULL for staff sessions.';

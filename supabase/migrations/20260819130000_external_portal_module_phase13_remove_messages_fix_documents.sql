-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 13
--
-- Two changes, per updated requirements:
--
-- 1. REMOVE MESSAGES. The Messages feature (external_portal_case_links,
--    external_portal_case_messages, Phase 11) was exclusively part of
--    this External Portal module — it shares nothing with the old
--    portal, so this is a clean, contained removal. The UI (routes,
--    nav items, admin "Case Access" dialog) has already been removed
--    from the application. This migration removes the corresponding
--    database access so the feature can't be reached by calling the
--    API directly either. The underlying tables and any message
--    history already sent are intentionally left in place (not
--    dropped) rather than destroyed, in case you want to export or
--    retain that history for compliance — say the word if you'd
--    rather they were dropped outright.
--
-- 2. FIX DOCUMENTS. Independently of the messages change, this audit
--    found the live `documents` SELECT/INSERT/UPDATE policies never
--    actually checked case ownership at all — they compared the
--    uploading staff member's own profile.referring_attorney_id
--    against the viewer's, which is null for internal staff. Since
--    staff (not attorneys) upload almost every document, this made
--    Documents empty for real attorney users regardless of portal
--    type, and is unrelated to firm-vs-individual. Fixed here to key
--    off the document's own appointment/claimant, the same as
--    expert_reports (Phase 12) — bridged External Portal sessions get
--    the individual-contact check, native/old-portal logins keep
--    their existing firm-level access unchanged.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Remove Messages access at the database layer.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Portal users view own case links" ON public.external_portal_case_links;
DROP POLICY IF EXISTS "Portal users view own case messages" ON public.external_portal_case_messages;
DROP POLICY IF EXISTS "Portal users send own case messages" ON public.external_portal_case_messages;
DROP POLICY IF EXISTS "Portal users mark case messages read" ON public.external_portal_case_messages;

REVOKE ALL ON public.external_portal_case_links FROM authenticated;
REVOKE ALL ON public.external_portal_case_messages FROM authenticated;

-- RLS stays enabled with no policies left for these roles, so both
-- tables are now unreachable by anyone except service-role/admin
-- tooling — matching "removed", not "broken".

COMMENT ON TABLE public.external_portal_case_links IS
  'Phase 13: Messages feature removed from the External Portal. Table retained for historical data only — no roles are currently granted access.';
COMMENT ON TABLE public.external_portal_case_messages IS
  'Phase 13: Messages feature removed from the External Portal. Table retained for historical data only — no roles are currently granted access.';

-- ---------------------------------------------------------------------
-- 2. Fix `documents` — case-based, not uploader-based.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view documents from their law firm" ON public.documents;
CREATE POLICY "Users can view documents from their law firm"
ON public.documents
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (
      NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
      AND get_current_user_referring_attorney() IS NOT NULL
      AND (
        documents.referring_attorney_id = get_current_user_referring_attorney()
        OR EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = documents.appointment_id
            AND a.referring_attorney_id = get_current_user_referring_attorney()
        )
      )
    )
    OR (
      get_current_user_attorney_contact() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = documents.appointment_id
          AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
    OR (
      get_current_user_expert_id() IS NOT NULL
      AND (
        documents.expert_id = get_current_user_expert_id()
        OR EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = documents.appointment_id
            AND a.expert_id = get_current_user_expert_id()
        )
      )
    )
  )
);

COMMENT ON POLICY "Users can view documents from their law firm" ON public.documents IS
  'Phase 13: rewritten to check the document''s own case (appointment_id/claimant linkage), not the uploader''s profile — the old version compared the uploader''s firm to the viewer''s firm, which returned nothing for the vast majority of documents (uploaded by internal staff, who have no firm) regardless of who was asking.';

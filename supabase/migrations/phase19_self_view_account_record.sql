-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 19
-- Add a self-view SELECT policy on external_portal_accounts.
--
-- ROOT CAUSE: this table has had exactly one RLS policy since it was
-- created (Phase 1, 2026-08-04) — "Admins manage external portal
-- accounts", FOR ALL, USING (has_role(auth.uid(), 'admin')). No
-- bridged attorney or expert session has ever been granted SELECT on
-- their own row. This is why AttorneyProfile.tsx's "Portal Login"
-- section (display name / login email / account status) renders
-- blank — its query `.from('external_portal_accounts').eq('id',
-- myAccountId)` is exactly this table, and a non-admin bridged session
-- gets 0 rows back regardless of how correctly myAccountId resolves
-- (Phase 16 already fixed that resolution itself; this is the
-- separate, final step — actually being allowed to read the row once
-- resolved).
--
-- Scope: SELECT only, and only the caller's own row — matched by
-- email against their own profile, the same unique identifier Phase
-- 16/18 already use for this exact purpose. No write access is
-- granted here; email/detail changes correctly stay admin-only per
-- AttorneyProfile.tsx's existing design (see its own comments on why
-- self-service email changes aren't offered).
-- =====================================================================

CREATE POLICY "Portal users view own account record"
ON public.external_portal_accounts FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_external_portal_user = true
      AND lower(p.email) = lower(external_portal_accounts.email)
      AND (
        (external_portal_accounts.portal_type = 'attorney' AND p.role = 'referring_attorney')
        OR (external_portal_accounts.portal_type = 'expert' AND p.role = 'medical_expert')
      )
  )
);

COMMENT ON POLICY "Portal users view own account record" ON public.external_portal_accounts IS
  'Phase 19: lets a bridged attorney/expert session SELECT their own account row (matched by email, same identifier Phase 16/18 use) — previously this table only had an admin-only FOR ALL policy, so AttorneyProfile.tsx''s Portal Login section always rendered blank for every non-admin bridged session.';

-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 24
-- expert_reports never had an expert_id RLS branch — found while
-- investigating why every medical expert's Performance page showed
-- exactly 60%, regardless of their actual track record.
--
-- Phase 20 rewrote expert_reports' SELECT policies with a three-branch
-- shape (native/firm-scope/individual-scope) — all attorney-facing.
-- Phase 21 fixed the equivalent missing-expert-branch gap on
-- appointments and claimants, but expert_reports itself was missed:
-- neither policy on this table has ever, at any point in the
-- migration history, granted access by expert_id.
--
-- CONCRETE IMPACT: a bridged expert session's
-- `.from('expert_reports').eq('expert_id', ...)` query — used by
-- ExpertPerformance.tsx, ExpertReportTracking.tsx, ExpertCases.tsx,
-- and ExpertDashboard.tsx — returns zero rows for every expert. On
-- ExpertPerformance.tsx specifically, zero reports collapses every
-- one of its component scores to their no-data defaults
-- (completionScore=0, speedScore=100, onTimeRate=100, qualityScore=50),
-- which the page's weighted formula (0.3/0.3/0.2/0.2) combines to
-- EXACTLY 60 every time — independent of which expert is logged in.
-- That's the "every expert is on 60%" symptom, not a coincidence.
-- =====================================================================

DROP POLICY IF EXISTS "Users can view expert reports from their referring attorney" ON public.expert_reports;
CREATE POLICY "Users can view expert reports from their referring attorney"
ON public.expert_reports FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.id = expert_reports.appointment_id
    AND a.deleted_at IS NULL
    AND (
      (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_portal_account_scope() = 'firm'
        AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_portal_account_scope() = 'individual'
        AND a.assigned_attorney_contact_id IS NOT NULL
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
)
OR (
  get_current_user_expert_id() IS NOT NULL
  AND expert_reports.expert_id = get_current_user_expert_id()
));

COMMENT ON POLICY "Users can view expert reports from their referring attorney" ON public.expert_reports IS
  'Phase 20/24: firm-scoped, individual-scoped, and expert branches. The expert branch (Phase 24) closes a gap that predates the firm/individual work entirely and was also missed by Phase 21''s otherwise-comprehensive expert-access pass — no policy on this table had ever granted access by expert_id, so a bridged expert session''s own report-tracking and performance queries had no RLS path to succeed, silently returning zero rows.';

-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 21
-- Expert-side RLS gaps found while investigating the "Medical Expert
-- Portal is working" claim against the actual policy history.
--
-- FINDING 1: no policy, at any point in the migration history, has
-- ever granted appointments/claimants access by expert_id. The expert
-- portal's core case-list query (ExpertCases.tsx: `.from('appointments')
-- .eq('expert_id', ...)`) has no RLS path to succeed. This predates
-- Phase 12-20 entirely and is unrelated to the firm/individual work.
-- Purely additive — mirrors the exact expert_id branch already proven
-- correct on documents/case_timelines/document_checklist/expert_payments.
--
-- FINDING 2: referring_attorneys has no branch granting bridged expert
-- sessions access at all, so the nested `referring_attorneys:
-- referring_attorney_id(name)` join in ExpertCases.tsx resolves to
-- null for every case -> displayed as "N/A" (the same fallback-value
-- bug class the original audit asked to trace). Scoped narrowly: an
-- expert can see the firm name for a firm that is a party to one of
-- their own appointments — nothing broader.
--
-- FINDING 3 (security): medical_experts' current SELECT policy is
-- `USING (true)` — every authenticated user, including every bridged
-- attorney portal session (firm or individual), can read every
-- expert's full record: HPCSA number, personal contact number,
-- personal assistant contact, and complete fee schedule (consultation/
-- court/addendum/affidavit/merit/joint-minutes fees) for experts who
-- have nothing to do with their cases. This is the blanket policy
-- Phase 15 flagged and explicitly left unfixed pending proof of an
-- actual defect. It's now been demonstrated as one, so it's closed
-- here — scoped so internal/native (non-bridged) staff logins keep
-- exactly the broad access they have today (needed to browse the full
-- expert directory when scheduling a new appointment for any firm),
-- and only bridged external-portal sessions are narrowed to the
-- experts actually relevant to them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. appointments — add the missing expert_id branch.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view appointments from their referring attorney" ON public.appointments;
CREATE POLICY "Users can view appointments from their referring attorney"
ON public.appointments FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    (
      NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
      AND referring_attorney_id = get_current_user_referring_attorney()
    )
    OR (
      get_current_user_portal_account_scope() = 'firm'
      AND referring_attorney_id = get_current_user_referring_attorney()
    )
    OR (
      get_current_user_portal_account_scope() = 'individual'
      AND assigned_attorney_contact_id IS NOT NULL
      AND assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
    OR (
      get_current_user_expert_id() IS NOT NULL
      AND expert_id = get_current_user_expert_id()
    )
  )
);

COMMENT ON POLICY "Users can view appointments from their referring attorney" ON public.appointments IS
  'Phase 20/21: firm-scoped, individual-scoped, and expert branches. The expert branch (Phase 21) closes a gap that predates the firm/individual work entirely — no policy on this table had ever granted access by expert_id, so a bridged expert session''s own appointments query had no RLS path to succeed.';

-- ---------------------------------------------------------------------
-- 2. claimants — add the missing expert_id branch (needed by any
--    expert-portal page that reads claimant details via the claimant,
--    not just via the appointment join).
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view claimants based on role" ON public.claimants;
CREATE POLICY "Users can view claimants based on role"
ON public.claimants
FOR SELECT
TO authenticated
USING (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
  OR (
    get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.claimant_id = claimants.id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
  )
  OR (
    get_current_user_expert_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.claimant_id = claimants.id
        AND a.expert_id = get_current_user_expert_id()
    )
  )
);

-- ---------------------------------------------------------------------
-- 3. referring_attorneys — narrow expert-facing branch so a bridged
--    expert session can resolve the firm name on their own cases
--    (fixes the "N/A" attorney_name in ExpertCases.tsx), without
--    granting anything broader.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Medical experts can view referring attorneys on their own cases" ON public.referring_attorneys;
CREATE POLICY "Medical experts can view referring attorneys on their own cases"
ON public.referring_attorneys
FOR SELECT
USING (
  get_current_user_expert_id() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.referring_attorney_id = referring_attorneys.id
      AND a.expert_id = get_current_user_expert_id()
      AND a.deleted_at IS NULL
  )
);

-- ---------------------------------------------------------------------
-- 4. medical_experts — close the blanket USING(true) SELECT policy.
--    Native/internal (non-bridged) logins keep full access unchanged
--    (staff need to browse the whole directory to schedule any
--    appointment). Bridged sessions are scoped to experts relevant to
--    them: an attorney (firm or individual, per Phase 20) sees experts
--    on cases they can see; an expert sees their own record.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view active medical experts" ON public.medical_experts;
CREATE POLICY "Authenticated users can view active medical experts"
ON public.medical_experts
FOR SELECT
TO authenticated
USING (
  NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
  OR (
    get_current_user_expert_id() IS NOT NULL
    AND medical_experts.id = get_current_user_expert_id()
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.expert_id = medical_experts.id
        AND a.referring_attorney_id = get_current_user_referring_attorney()
        AND a.deleted_at IS NULL
    )
  )
  OR (
    get_current_user_portal_account_scope() = 'individual'
    AND get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.expert_id = medical_experts.id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
        AND a.deleted_at IS NULL
    )
  )
);

COMMENT ON POLICY "Authenticated users can view active medical experts" ON public.medical_experts IS
  'Phase 21: closed the previous USING(true) blanket grant, which exposed every expert''s HPCSA number, personal contact details, and full fee schedule to any authenticated user, including every external-portal attorney login regardless of whether that expert was on any of their cases (flagged by Phase 15, left unfixed pending proof — now demonstrated). Native/internal logins are unaffected; bridged external-portal sessions are now scoped to experts actually relevant to them.';

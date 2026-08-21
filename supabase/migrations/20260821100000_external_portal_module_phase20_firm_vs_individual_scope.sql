-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 20
-- Firm-vs-individual account scope.
--
-- WHY: Phase 12 solved a real bug (two individuals at the same firm,
-- each with their own portal account, seeing each other's full case
-- list) by making assigned_attorney_contact_id the ONLY thing bridged
-- attorney sessions are checked against. That was correct for the
-- individual-attorney-with-no-firm case, but wrong for the firm case:
-- a firm is one external customer and should see every case belonging
-- to that firm, regardless of which individual inside it a case is
-- currently assigned to. The admin UI (ExternalPortalAccessLinks.tsx)
-- currently makes choosing an individual mandatory for every attorney
-- account, so there has never been a way to create a true firm-level
-- account at all.
--
-- SEPARATELY, and independently of the above: a pre-existing policy
-- from 2025-11-03, "Admins and employees can view all appointments
-- for debt management", was never touched by Phases 12-15 and has no
-- is_external_portal_user check at all — it grants
-- `referring_attorney_id IN (SELECT referring_attorney_id FROM
-- profiles WHERE id = auth.uid())` to ANY authenticated user,
-- including bridged sessions. Postgres ORs permissive policies
-- together, so this has been silently granting full firm-wide
-- `appointments` access to every bridged attorney session all along —
-- bypassing the Phase 12 restriction sitting right next to it. The
-- identical pattern exists on `aod_documents`, and a joined variant on
-- `expert_reports`. This migration closes those (folding their
-- legitimate staff-facing purpose into the same scope-aware policy)
-- rather than leaving an unscoped, undocumented backdoor in place.
--
-- APPROACH: give every attorney external_portal_accounts row an
-- explicit account_scope ('firm' | 'individual') instead of inferring
-- it implicitly from whether a contact happens to be set. Firm-scoped
-- accounts are checked against referring_attorney_id (the whole firm).
-- Individual-scoped accounts keep the exact Phase 12 behaviour,
-- checked against assigned_attorney_contact_id. Medical experts are
-- untouched — medical_experts is already one row per individual
-- person, so there is nothing to scope.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. account_scope enum + column.
-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.external_portal_account_scope AS ENUM ('firm', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.external_portal_accounts
  ADD COLUMN IF NOT EXISTS account_scope public.external_portal_account_scope;

-- Backfill: every attorney account today was created through a flow
-- that made choosing an individual contact mandatory, so preserve
-- exactly the current (narrower) behaviour for existing accounts by
-- default — nobody's visibility silently widens as a side effect of
-- this migration. An admin can deliberately switch a given account to
-- 'firm' afterwards via the admin UI (Phase 20 frontend change).
UPDATE public.external_portal_accounts
SET account_scope = CASE
  WHEN portal_type = 'attorney' AND assigned_attorney_contact_id IS NOT NULL THEN 'individual'::public.external_portal_account_scope
  WHEN portal_type = 'attorney' THEN 'firm'::public.external_portal_account_scope
  ELSE NULL
END
WHERE account_scope IS NULL;

COMMENT ON COLUMN public.external_portal_accounts.account_scope IS
  'Phase 20: for attorney accounts, whether this portal account represents the WHOLE firm (sees every case referred by that referring_attorneys row) or ONE INDIVIDUAL at that firm (sees only appointments.assigned_attorney_contact_id matches). NULL for expert accounts — experts are always individually scoped via medical_expert_id, which needs no separate scope concept.';

-- ---------------------------------------------------------------------
-- 2. Resolver function — same "match by email" pattern Phase 16 already
--    established, rather than a second profiles column that could go
--    stale the way profiles.attorney_contact_id did before Phase 12's
--    edge-function sync existed. Returns NULL for staff/non-bridged
--    sessions and for expert sessions (scope doesn't apply to them).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_current_user_portal_account_scope()
RETURNS public.external_portal_account_scope
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT epa.account_scope
  FROM public.external_portal_accounts epa
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE epa.deleted_at IS NULL
    AND COALESCE(p.is_external_portal_user, false)
    AND lower(epa.email) = lower(p.email)
    AND epa.portal_type = 'attorney'
    AND p.role = 'referring_attorney'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_portal_account_scope() TO authenticated;
REVOKE ALL ON FUNCTION public.get_current_user_portal_account_scope() FROM anon;

COMMENT ON FUNCTION public.get_current_user_portal_account_scope() IS
  'Phase 20: resolves the calling bridged attorney session''s account_scope (firm|individual) by matching external_portal_accounts.email against the bridged profile''s own email — same identifier Phase 16/19 already use. NULL for staff, non-bridged (native) portal logins, and expert sessions.';

-- ---------------------------------------------------------------------
-- 3. appointments — the core fix. Three branches now:
--    a) native/old-portal firm-level login (unchanged from Phase 12)
--    b) bridged + account_scope = 'firm' → whole firm, by referring_attorney_id
--    c) bridged + account_scope = 'individual' → only the assigned contact
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
  )
);

-- Close the debt-management backdoor on appointments — fold its
-- legitimate staff purpose (admin/employee full visibility) into a
-- policy that no longer also hands bridged attorney sessions
-- unscoped, firm-wide access regardless of account_scope.
DROP POLICY IF EXISTS "Admins and employees can view all appointments for debt management" ON public.appointments;
CREATE POLICY "Admins and employees can view all appointments for debt management"
ON public.appointments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'employee')
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
);

COMMENT ON POLICY "Admins and employees can view all appointments for debt management" ON public.appointments IS
  'Phase 20: narrowed to drop the unconditional referring_attorney_id match, which — having no is_external_portal_user check — silently granted every bridged attorney session full firm-wide appointment access regardless of account_scope, undermining Phase 12-15''s individual-isolation work entirely. Native/old-portal logins keep firm-level access here as before; bridged sessions now get their access exclusively through the policy above (scope-aware).';

-- ---------------------------------------------------------------------
-- 4. expert_reports — same three-branch shape.
-- ---------------------------------------------------------------------

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
));

DROP POLICY IF EXISTS "Admins and employees can view all expert reports" ON public.expert_reports;
CREATE POLICY "Admins and employees can view all expert reports"
ON public.expert_reports
FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'employee')
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_reports.appointment_id
        AND a.referring_attorney_id = get_current_user_referring_attorney()
    )
  )
);

COMMENT ON POLICY "Admins and employees can view all expert reports" ON public.expert_reports IS
  'Phase 20: narrowed the same way as the appointments debt-management policy — the EXISTS join here had no is_external_portal_user check either, so it granted bridged attorney sessions firm-wide expert_reports access unconditionally. Bridged sessions now go exclusively through the scope-aware policy above.';

-- ---------------------------------------------------------------------
-- 5. documents / case_timelines / document_checklist / expert_payments
--    — add the missing 'firm' branch. These tables had no legacy
--    backdoor (Phase 12-15 correctly locked them to individual-only
--    for bridged sessions with nothing else granting broader access),
--    so a firm-scoped account currently sees appointments/reports but
--    NOT documents/timeline/payments for those same cases — exactly
--    the inconsistent symptom flagged in the audit.
-- ---------------------------------------------------------------------

-- documents ------------------------------------------------------------
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
      get_current_user_portal_account_scope() = 'firm'
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

DROP POLICY IF EXISTS "Users can create documents for their law firm" ON public.documents;
CREATE POLICY "Users can create documents for their law firm"
ON public.documents
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = uploaded_by
  AND (
    is_system_admin()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR (
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
      get_current_user_portal_account_scope() = 'firm'
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
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = documents.appointment_id
          AND a.expert_id = get_current_user_expert_id()
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can update documents from their law firm" ON public.documents;
CREATE POLICY "Users can update documents from their law firm"
ON public.documents
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    is_system_admin()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR (
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
      get_current_user_portal_account_scope() = 'firm'
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
  )
);

-- case_timelines ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can view timelines from their referring attorney" ON public.case_timelines;
CREATE POLICY "Users can view timelines from their referring attorney"
ON public.case_timelines FOR SELECT
USING (
  (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
  OR (
    get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = case_timelines.appointment_id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
  )
  OR (
    get_current_user_expert_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = case_timelines.appointment_id
        AND a.expert_id = get_current_user_expert_id()
    )
  )
);

-- document_checklist -------------------------------------------------------
DROP POLICY IF EXISTS "Users can view document checklist for their claimants" ON public.document_checklist;
CREATE POLICY "Users can view document checklist for their claimants"
ON public.document_checklist
FOR SELECT
USING (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND get_current_user_referring_attorney() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.claimants c
      WHERE c.id = document_checklist.claimant_id
        AND c.referring_attorney_id = get_current_user_referring_attorney()
    )
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND EXISTS (
      SELECT 1 FROM public.claimants c
      WHERE c.id = document_checklist.claimant_id
        AND c.referring_attorney_id = get_current_user_referring_attorney()
    )
  )
  OR (
    get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.claimant_id = document_checklist.claimant_id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
  )
  OR (
    get_current_user_expert_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.claimant_id = document_checklist.claimant_id
        AND a.expert_id = get_current_user_expert_id()
    )
  )
);

-- expert_payments ------------------------------------------------------
DROP POLICY IF EXISTS "Users can view expert payments from their referring attorney" ON public.expert_payments;
CREATE POLICY "Users can view expert payments from their referring attorney"
ON public.expert_payments
FOR SELECT
TO authenticated
USING (
  (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_payments.appointment_id
        AND a.referring_attorney_id = get_current_user_referring_attorney()
    )
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_payments.appointment_id
        AND a.referring_attorney_id = get_current_user_referring_attorney()
    )
  )
  OR (
    get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_payments.appointment_id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
  )
  OR (
    get_current_user_expert_id() IS NOT NULL
    AND expert_payments.expert_id = get_current_user_expert_id()
  )
);

-- ---------------------------------------------------------------------
-- 6. claimants — add the missing 'firm' branch alongside the existing
--    individual-contact branch (Phase 12).
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
);

-- ---------------------------------------------------------------------
-- 7. aod_documents — close the same unscoped debt-management backdoor,
--    add the explicit 'firm' branch. AODs remain firm-wide-only (per
--    Phase 14's note: there is no data linking one AOD to one
--    individual attorney), so a firm-scoped account sees them exactly
--    as staff/native logins already do; an individual-scoped account
--    does not (unchanged from today).
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins and employees can view all AOD documents" ON public.aod_documents;
CREATE POLICY "Admins and employees can view all AOD documents"
ON public.aod_documents
FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'employee')
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
);

COMMENT ON POLICY "Admins and employees can view all AOD documents" ON public.aod_documents IS
  'Phase 20: same fix as the appointments/expert_reports debt-management policies — closed the unconditional referring_attorney_id match (no is_external_portal_user check) that granted every bridged attorney session firm-wide AOD access regardless of account_scope. Bridged sessions now get this exclusively through the explicit firm-scope branch.';

-- ---------------------------------------------------------------------
-- 8. Assignment RPC — no behavioural change needed (still only
--    relevant to individual-scoped accounts), but document the
--    relationship to account_scope for the next reader.
-- ---------------------------------------------------------------------

COMMENT ON FUNCTION public.assign_appointment_attorney_contact IS
  'Phase 14/20: assigns an appointment to a specific individual referring_attorney_contacts row. Only meaningful for accounts with account_scope = ''individual'' — a firm-scoped account already sees every appointment for its firm regardless of this assignment. Staff/admin only.';

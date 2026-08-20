-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 14
--
-- Closes out the remaining case-linked tables (case_timelines,
-- document_checklist), fixes the documents INSERT/UPDATE gap (an
-- attorney could currently point a new document row at any
-- appointment_id — a write-side integrity issue, separate from the
-- read-side leak fixed in Phase 13), and adds the Appointment Engine
-- assignment tooling requested (RPC + admin-usable function; the
-- actual UI wiring is documented in the accompanying frontend changes
-- in this same pass).
--
-- aod_documents / aod_payments were investigated and are deliberately
-- NOT touched here — see the note near the bottom for why.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. case_timelines — same pattern as appointments/expert_reports/
--    claimants/documents: bridged sessions get the individual-contact
--    check via the linked appointment; native/old-portal logins keep
--    their existing firm-level access unchanged.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view timelines from their referring attorney" ON public.case_timelines;
CREATE POLICY "Users can view timelines from their referring attorney"
ON public.case_timelines FOR SELECT
USING (
  (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
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

-- INSERT/UPDATE for case_timelines are staff-driven (the auto-phase
-- trigger + admin/employee edits) — left untouched; only the SELECT
-- (what an external user can read) needed the individual-contact fix.

-- ---------------------------------------------------------------------
-- 2. document_checklist — no attorney/expert column of its own, scoped
--    via its claimant, so we check the same way SELECT on `claimants`
--    itself does: EXISTS(...) against an appointment for that claimant
--    with the right individual assignment.
-- ---------------------------------------------------------------------

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

-- INSERT/UPDATE on document_checklist stay as staff/admin-driven
-- operations (checking off submitted documents) — not something
-- external portal users do today, so left untouched.

-- ---------------------------------------------------------------------
-- 3. documents INSERT/UPDATE — the real fix. The live INSERT policy
--    only checked "does the uploader have SOME referring_attorney_id",
--    never that the appointment_id being written actually belongs to
--    them. That meant any authenticated attorney (native or bridged)
--    could insert a document row against an appointment_id belonging
--    to a different firm/person. Rewritten to verify ownership of the
--    target appointment/claimant at write time, mirroring the SELECT
--    policy from Phase 13 exactly — same authorization boundary for
--    reads and writes.
-- ---------------------------------------------------------------------

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
      get_current_user_attorney_contact() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = documents.appointment_id
          AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
  )
);

-- ---------------------------------------------------------------------
-- 4. Appointment Engine assignment RPC — a proper, callable function
--    (not raw SQL as the permanent interface) for staff to assign or
--    change an appointment's individual attorney contact, used by the
--    new admin UI field (see NewAppointmentModule.tsx /
--    AdminAppointmentEngine changes in this pass). Auto-creates the
--    contact row if it doesn't exist yet for that firm+name/email,
--    reusing referring_attorney_contacts rather than duplicating it.
--    Staff-only; never callable by an external portal session.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_appointment_attorney_contact(
  p_appointment_id UUID,
  p_referring_attorney_id UUID,
  p_contact_full_name TEXT,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  IF NOT (is_system_admin() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized to assign attorney contacts';
  END IF;

  IF p_contact_full_name IS NULL OR btrim(p_contact_full_name) = '' THEN
    RAISE EXCEPTION 'Contact name is required';
  END IF;

  IF p_contact_email IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.referring_attorney_contacts
    WHERE referring_attorney_id = p_referring_attorney_id
      AND lower(email) = lower(p_contact_email)
      AND is_active
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.referring_attorney_contacts (referring_attorney_id, full_name, email, phone, created_by)
    VALUES (p_referring_attorney_id, btrim(p_contact_full_name), p_contact_email, p_contact_phone, auth.uid())
    RETURNING id INTO v_contact_id;
  END IF;

  UPDATE public.appointments
  SET assigned_attorney_contact_id = v_contact_id
  WHERE id = p_appointment_id
    AND referring_attorney_id = p_referring_attorney_id; -- guards against assigning a contact from a different firm

  RETURN v_contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_appointment_attorney_contact(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.assign_appointment_attorney_contact(UUID, UUID, TEXT, TEXT, TEXT) FROM anon;

COMMENT ON FUNCTION public.assign_appointment_attorney_contact IS
  'Phase 14: the permanent, non-SQL way to assign an appointment to a specific individual referring attorney contact. Reuses an existing referring_attorney_contacts row (matched by firm + email) instead of creating a duplicate. Staff/admin only.';

-- ---------------------------------------------------------------------
-- aod_documents / aod_payments — investigated, deliberately unchanged.
-- aod_documents has no appointment_id or claimant_id at all: it
-- references attorneys(id) (the sales-pipeline table, unrelated to
-- case ownership) and referring_attorney_id, and represents a
-- firm-wide payment/deposit agreement, not a specific case. There is
-- no data anywhere that says "this AOD belongs to this one individual
-- attorney rather than their firm" — inventing that split would be
-- exactly the kind of guess you told me not to make. This stays
-- firm-scoped, same as it is today, for both native and bridged
-- sessions, until/unless you tell me AODs should in fact be split per
-- individual (in which case the Appointment Engine would need that
-- relationship added first, the same way it needed one for cases).
-- ---------------------------------------------------------------------

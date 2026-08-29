-- External Portal case-mirror rework
--
-- external_portal_cases / external_portal_case_documents /
-- external_portal_case_events were built for an earlier, abandoned
-- auth design (a custom `external_account_id` JWT claim that nothing
-- in the codebase ever sets — external users were never meant to get
-- an auth.users row under that design). All three tables are empty
-- and nothing in the frontend reads them.
--
-- The auth model that actually shipped (Phase 12+) bridges a verified
-- OTP/access-link login into a real Supabase Auth session backed by
-- profiles (is_external_portal_user, referring_attorney_id,
-- attorney_contact_id, expert_id). This migration repoints these
-- three tables onto that live model, adds triggers to keep them in
-- sync with appointments/documents/case_timelines, and backfills
-- existing data. Portal pages can then read these dedicated tables
-- instead of querying appointments/claimants/documents/case_timelines
-- directly — nothing here changes login or touches those tables'
-- own RLS.

-- ---------------------------------------------------------------------
-- 1. external_portal_cases: one row per appointment
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS external_portal_cases_select ON public.external_portal_cases;

ALTER TABLE public.external_portal_cases
  DROP COLUMN IF EXISTS external_account_id,
  DROP COLUMN IF EXISTS portal_viewer_type,
  DROP COLUMN IF EXISTS portal_viewer_ref_id,
  DROP COLUMN IF EXISTS firm_scope;

ALTER TABLE public.external_portal_cases
  ADD COLUMN IF NOT EXISTS claimant_id uuid REFERENCES public.claimants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referring_attorney_id uuid REFERENCES public.referring_attorneys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_attorney_contact_id uuid REFERENCES public.referring_attorney_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expert_id uuid REFERENCES public.medical_experts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.external_portal_cases
  ADD CONSTRAINT external_portal_cases_appointment_id_key UNIQUE (appointment_id);

CREATE POLICY "External portal users view their own cases"
  ON public.external_portal_cases FOR SELECT
  TO authenticated
  USING (
    is_system_admin()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR (
      get_current_user_portal_account_scope() = 'firm'::external_portal_account_scope
      AND referring_attorney_id = get_current_user_referring_attorney()
    )
    OR (
      get_current_user_attorney_contact() IS NOT NULL
      AND assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
    OR (
      get_current_user_expert_id() IS NOT NULL
      AND expert_id = get_current_user_expert_id()
    )
  );

GRANT SELECT ON public.external_portal_cases TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.external_portal_cases FROM authenticated;

-- ---------------------------------------------------------------------
-- 2. external_portal_case_documents: one row per document visible
--    externally, mirrored from public.documents
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS external_portal_case_documents_select ON public.external_portal_case_documents;

ALTER TABLE public.external_portal_case_documents
  DROP COLUMN IF EXISTS external_account_id,
  DROP COLUMN IF EXISTS portal_viewer_type,
  DROP COLUMN IF EXISTS portal_viewer_ref_id;

ALTER TABLE public.external_portal_case_documents
  ADD COLUMN IF NOT EXISTS is_visible_to_attorney boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_visible_to_expert boolean NOT NULL DEFAULT true;

ALTER TABLE public.external_portal_case_documents
  ADD CONSTRAINT external_portal_case_documents_document_id_key UNIQUE (document_id);

CREATE POLICY "External portal users view their own case documents"
  ON public.external_portal_case_documents FOR SELECT
  TO authenticated
  USING (
    is_system_admin()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR (
      is_visible_to_attorney
      AND EXISTS (
        SELECT 1 FROM public.external_portal_cases c
        WHERE c.appointment_id = external_portal_case_documents.appointment_id
          AND (
            (get_current_user_portal_account_scope() = 'firm'::external_portal_account_scope
              AND c.referring_attorney_id = get_current_user_referring_attorney())
            OR (get_current_user_attorney_contact() IS NOT NULL
              AND c.assigned_attorney_contact_id = get_current_user_attorney_contact())
          )
      )
    )
    OR (
      is_visible_to_expert
      AND get_current_user_expert_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.external_portal_cases c
        WHERE c.appointment_id = external_portal_case_documents.appointment_id
          AND c.expert_id = get_current_user_expert_id()
      )
    )
  );

GRANT SELECT ON public.external_portal_case_documents TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.external_portal_case_documents FROM authenticated;

-- ---------------------------------------------------------------------
-- 3. external_portal_case_events: one row per case_timelines entry
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS external_portal_case_events_select ON public.external_portal_case_events;

ALTER TABLE public.external_portal_case_events
  DROP COLUMN IF EXISTS external_account_id,
  DROP COLUMN IF EXISTS portal_viewer_type,
  DROP COLUMN IF EXISTS portal_viewer_ref_id;

ALTER TABLE public.external_portal_case_events
  ADD COLUMN IF NOT EXISTS timeline_id uuid;

ALTER TABLE public.external_portal_case_events
  ADD CONSTRAINT external_portal_case_events_timeline_id_key UNIQUE (timeline_id);

CREATE POLICY "External portal users view their own case events"
  ON public.external_portal_case_events FOR SELECT
  TO authenticated
  USING (
    is_system_admin()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.external_portal_cases c
      WHERE c.appointment_id = external_portal_case_events.appointment_id
        AND (
          (get_current_user_portal_account_scope() = 'firm'::external_portal_account_scope
            AND c.referring_attorney_id = get_current_user_referring_attorney())
          OR (get_current_user_attorney_contact() IS NOT NULL
            AND c.assigned_attorney_contact_id = get_current_user_attorney_contact())
          OR (get_current_user_expert_id() IS NOT NULL
            AND c.expert_id = get_current_user_expert_id())
        )
    )
  );

GRANT SELECT ON public.external_portal_case_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.external_portal_case_events FROM authenticated;

-- ---------------------------------------------------------------------
-- 4. Sync triggers — appointments -> external_portal_cases
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_external_portal_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.external_portal_cases WHERE appointment_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT first_name, last_name INTO v_first_name, v_last_name
  FROM public.claimants WHERE id = NEW.claimant_id;

  INSERT INTO public.external_portal_cases (
    appointment_id, claimant_id, referring_attorney_id,
    assigned_attorney_contact_id, expert_id, case_status, matter_type,
    appointment_date, claimant_first_name, claimant_last_name,
    deleted_at, updated_at
  ) VALUES (
    NEW.id, NEW.claimant_id, NEW.referring_attorney_id,
    NEW.assigned_attorney_contact_id, NEW.expert_id, NEW.case_status,
    NEW.matter_type, NEW.appointment_date, v_first_name, v_last_name,
    NEW.deleted_at, now()
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    claimant_id = EXCLUDED.claimant_id,
    referring_attorney_id = EXCLUDED.referring_attorney_id,
    assigned_attorney_contact_id = EXCLUDED.assigned_attorney_contact_id,
    expert_id = EXCLUDED.expert_id,
    case_status = EXCLUDED.case_status,
    matter_type = EXCLUDED.matter_type,
    appointment_date = EXCLUDED.appointment_date,
    claimant_first_name = EXCLUDED.claimant_first_name,
    claimant_last_name = EXCLUDED.claimant_last_name,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_external_portal_case() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_external_portal_case ON public.appointments;
CREATE TRIGGER trg_sync_external_portal_case
AFTER INSERT OR UPDATE OF claimant_id, referring_attorney_id, assigned_attorney_contact_id,
  expert_id, case_status, matter_type, appointment_date, deleted_at
OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_external_portal_case();

-- ---------------------------------------------------------------------
-- 5. Sync triggers — documents -> external_portal_case_documents
--    (only case-linked documents are portal-relevant)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_external_portal_case_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.external_portal_case_documents WHERE document_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.appointment_id IS NULL THEN
    DELETE FROM public.external_portal_case_documents WHERE document_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.external_portal_case_documents (
    appointment_id, document_id, document_type, file_name, file_path,
    upload_date, upload_time, is_visible_to_attorney, is_visible_to_expert
  ) VALUES (
    NEW.appointment_id, NEW.id, NEW.document_type, NEW.file_name, NEW.file_path,
    NEW.upload_date, NEW.upload_time,
    COALESCE(NEW.is_visible_to_attorney, true), COALESCE(NEW.is_visible_to_expert, true)
  )
  ON CONFLICT (document_id) DO UPDATE SET
    appointment_id = EXCLUDED.appointment_id,
    document_type = EXCLUDED.document_type,
    file_name = EXCLUDED.file_name,
    file_path = EXCLUDED.file_path,
    upload_date = EXCLUDED.upload_date,
    upload_time = EXCLUDED.upload_time,
    is_visible_to_attorney = EXCLUDED.is_visible_to_attorney,
    is_visible_to_expert = EXCLUDED.is_visible_to_expert;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_external_portal_case_document() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_external_portal_case_document ON public.documents;
CREATE TRIGGER trg_sync_external_portal_case_document
AFTER INSERT OR UPDATE OF appointment_id, document_type, file_name, file_path,
  upload_date, upload_time, is_visible_to_attorney, is_visible_to_expert
OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.sync_external_portal_case_document();

-- ---------------------------------------------------------------------
-- 6. Sync triggers — case_timelines -> external_portal_case_events
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_external_portal_case_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.external_portal_case_events WHERE timeline_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.external_portal_case_events (
    appointment_id, timeline_id, phase_name, phase_order, status,
    started_at, completed_at
  ) VALUES (
    NEW.appointment_id, NEW.id, NEW.phase_name, NEW.phase_order, NEW.status,
    NEW.started_at, NEW.completed_at
  )
  ON CONFLICT (timeline_id) DO UPDATE SET
    appointment_id = EXCLUDED.appointment_id,
    phase_name = EXCLUDED.phase_name,
    phase_order = EXCLUDED.phase_order,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_external_portal_case_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_external_portal_case_event ON public.case_timelines;
CREATE TRIGGER trg_sync_external_portal_case_event
AFTER INSERT OR UPDATE OF phase_name, phase_order, status, started_at, completed_at
OR DELETE ON public.case_timelines
FOR EACH ROW EXECUTE FUNCTION public.sync_external_portal_case_event();

-- ---------------------------------------------------------------------
-- 7. Backfill existing data
-- ---------------------------------------------------------------------

INSERT INTO public.external_portal_cases (
  appointment_id, claimant_id, referring_attorney_id,
  assigned_attorney_contact_id, expert_id, case_status, matter_type,
  appointment_date, claimant_first_name, claimant_last_name, deleted_at
)
SELECT
  a.id, a.claimant_id, a.referring_attorney_id, a.assigned_attorney_contact_id,
  a.expert_id, a.case_status, a.matter_type, a.appointment_date,
  c.first_name, c.last_name, a.deleted_at
FROM public.appointments a
LEFT JOIN public.claimants c ON c.id = a.claimant_id
ON CONFLICT (appointment_id) DO NOTHING;

INSERT INTO public.external_portal_case_documents (
  appointment_id, document_id, document_type, file_name, file_path,
  upload_date, upload_time, is_visible_to_attorney, is_visible_to_expert
)
SELECT
  d.appointment_id, d.id, d.document_type, d.file_name, d.file_path,
  d.upload_date, d.upload_time,
  COALESCE(d.is_visible_to_attorney, true), COALESCE(d.is_visible_to_expert, true)
FROM public.documents d
WHERE d.appointment_id IS NOT NULL
ON CONFLICT (document_id) DO NOTHING;

INSERT INTO public.external_portal_case_events (
  appointment_id, timeline_id, phase_name, phase_order, status,
  started_at, completed_at
)
SELECT
  t.appointment_id, t.id, t.phase_name, t.phase_order, t.status,
  t.started_at, t.completed_at
FROM public.case_timelines t
ON CONFLICT (timeline_id) DO NOTHING;

COMMENT ON TABLE public.external_portal_cases IS
  'One row per appointment, mirrored from public.appointments via trigger, for external portal reads that should not touch the internal appointments table directly. Secured by the same profiles/auth.uid()-based scope as appointments itself.';
COMMENT ON TABLE public.external_portal_case_documents IS
  'One row per case-linked document visible externally, mirrored from public.documents via trigger.';
COMMENT ON TABLE public.external_portal_case_events IS
  'One row per case_timelines entry, mirrored via trigger, for the portal case-status/timeline views.';

-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 29
-- The two remaining notification types flagged after Phase 28:
-- appointment_reminder and document_missing. Both are pure-Postgres
-- scheduled functions run via pg_cron (already used elsewhere in this
-- project — see remind-pending-payment-approvals-hourly) rather than
-- edge functions, since all they need to do is insert rows into
-- `notifications` — no external API call, no project URL/anon key
-- dependency to fill in.
--
-- BUSINESS RULES CHOSEN (stated explicitly, since these were flagged
-- last round as needing a real decision rather than an invented one):
--
-- appointment_reminder: fires once per appointment, when that
-- appointment is between 24 and 48 hours away. Runs hourly so the
-- window is caught reliably without firing more than once per
-- appointment (dedup via a check against notifications.related_record_id
-- + category). 24-48h is a common, unsurprising default for this kind
-- of reminder — adjust the window in the WHERE clause below if your
-- business wants a different lead time.
--
-- document_missing: a claimant's required-document checklist
-- (REQUIRED_DOCUMENTS in useDocumentChecklist.tsx: ID, medical
-- records, hospital file, police report, RAF1/RAF4, affidavits) is
-- considered to have a "missing" item once 7 days have passed since
-- the claimant record was created and that document type still has no
-- submitted checklist row. Runs once daily. Sends ONE consolidated
-- notification per claimant listing everything still missing, not one
-- notification per missing type, and won't re-notify the same
-- claimant more than once every 7 days (checked against the most
-- recent existing 'missing_document' notification for that claimant).
-- Both thresholds (7 days to first flag, 7 days between re-reminders)
-- are stated defaults, not hidden assumptions — change them here if
-- your business needs a different cadence.
--
-- Both target the same firm/individual-scoped set of attorney profiles
-- as Phase 28, for consistency.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------------
-- appointment_reminder
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_appointment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt RECORD;
  v_claimant_name text;
  v_expert_name text;
  v_message text;
BEGIN
  FOR v_appt IN
    SELECT a.id, a.appointment_date, a.claimant_id, a.expert_id,
           a.referring_attorney_id, a.assigned_attorney_contact_id
    FROM public.appointments a
    WHERE a.deleted_at IS NULL
      AND a.appointment_date BETWEEN now() + interval '24 hours' AND now() + interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.related_table = 'appointments'
          AND n.related_record_id = a.id
          AND n.category = 'appointment_reminder'
      )
  LOOP
    SELECT trim(concat_ws(' ', c.first_name, c.last_name)) INTO v_claimant_name
    FROM public.claimants c WHERE c.id = v_appt.claimant_id;

    SELECT trim(concat_ws(' ', m.first_name, m.last_name)) INTO v_expert_name
    FROM public.medical_experts m WHERE m.id = v_appt.expert_id;

    v_message := 'Assessment for ' || COALESCE(NULLIF(v_claimant_name, ''), 'your claimant')
      || ' with ' || COALESCE(NULLIF(v_expert_name, ''), 'the assigned expert')
      || ' is scheduled for ' || to_char(v_appt.appointment_date, 'DD Mon YYYY, HH24:MI') || '.';

    -- Attorneys for this case (same targeting rule as Phase 28)
    INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
    SELECT DISTINCT p.id, 'Upcoming Appointment', v_message, 'appointment_reminder', 'appointment_reminder', v_appt.id, 'appointments'
    FROM public.profiles p
    LEFT JOIN public.external_portal_accounts epa
      ON epa.portal_type = 'attorney' AND epa.deleted_at IS NULL AND lower(epa.email) = lower(p.email)
    WHERE p.referring_attorney_id = v_appt.referring_attorney_id
      AND (
        NOT COALESCE(p.is_external_portal_user, false)
        OR (COALESCE(p.is_external_portal_user, false) AND epa.account_scope = 'firm')
        OR (
          COALESCE(p.is_external_portal_user, false) AND epa.account_scope = 'individual'
          AND p.attorney_contact_id IS NOT NULL AND p.attorney_contact_id = v_appt.assigned_attorney_contact_id
        )
      );

    -- The assigned expert, if they've ever logged into the portal
    INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
    SELECT DISTINCT p.id, 'Upcoming Appointment', v_message, 'appointment_reminder', 'appointment_reminder', v_appt.id, 'appointments'
    FROM public.profiles p
    WHERE p.expert_id = v_appt.expert_id
      AND COALESCE(p.is_external_portal_user, false);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_appointment_reminders() IS
  'Phase 29: notifies the relevant attorney(s) and expert 24-48h before an appointment. Scheduled hourly; dedup via a check against existing appointment_reminder notifications for the same appointment, so it never double-fires.';

DO $$
DECLARE existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'send-appointment-reminders-hourly';
  IF existing_jobid IS NOT NULL THEN PERFORM cron.unschedule(existing_jobid); END IF;
END $$;

SELECT cron.schedule(
  'send-appointment-reminders-hourly',
  '0 * * * *',
  $$SELECT public.send_appointment_reminders();$$
);

-- ---------------------------------------------------------------------
-- document_missing
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_missing_document_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimant RECORD;
  v_missing_labels text[];
  v_referring_attorney_id uuid;
  v_assigned_attorney_contact_id uuid;
  v_message text;
  v_required_types CONSTANT jsonb := '[
    {"type":"id_document","label":"ID Document"},
    {"type":"med_records","label":"Medical Records"},
    {"type":"hospital_file","label":"Hospital File"},
    {"type":"police_report","label":"Police Report"},
    {"type":"raf1_raf4","label":"RAF1 or RAF4"},
    {"type":"affidavits","label":"Supporting Affidavits"}
  ]'::jsonb;
  v_req jsonb;
BEGIN
  FOR v_claimant IN
    SELECT c.id, c.referring_attorney_id
    FROM public.claimants c
    WHERE c.created_at <= now() - interval '7 days'
      -- Don't re-notify for the same claimant more than once every 7 days
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.related_table = 'claimants'
          AND n.related_record_id = c.id
          AND n.category = 'missing_document'
          AND n.created_at > now() - interval '7 days'
      )
  LOOP
    v_missing_labels := ARRAY[]::text[];
    FOR v_req IN SELECT * FROM jsonb_array_elements(v_required_types)
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.document_checklist dc
        WHERE dc.claimant_id = v_claimant.id
          AND dc.document_type = v_req->>'type'
          AND dc.is_submitted = true
      ) THEN
        v_missing_labels := array_append(v_missing_labels, v_req->>'label');
      END IF;
    END LOOP;

    CONTINUE WHEN array_length(v_missing_labels, 1) IS NULL;

    v_referring_attorney_id := v_claimant.referring_attorney_id;
    CONTINUE WHEN v_referring_attorney_id IS NULL;

    SELECT a.assigned_attorney_contact_id INTO v_assigned_attorney_contact_id
    FROM public.appointments a
    WHERE a.claimant_id = v_claimant.id AND a.deleted_at IS NULL
    ORDER BY a.appointment_date DESC LIMIT 1;

    v_message := 'Still outstanding: ' || array_to_string(v_missing_labels, ', ') || '.';

    INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
    SELECT DISTINCT p.id, 'Missing Documents', v_message, 'document_missing', 'missing_document', v_claimant.id, 'claimants'
    FROM public.profiles p
    LEFT JOIN public.external_portal_accounts epa
      ON epa.portal_type = 'attorney' AND epa.deleted_at IS NULL AND lower(epa.email) = lower(p.email)
    WHERE p.referring_attorney_id = v_referring_attorney_id
      AND (
        NOT COALESCE(p.is_external_portal_user, false)
        OR (COALESCE(p.is_external_portal_user, false) AND epa.account_scope = 'firm')
        OR (
          COALESCE(p.is_external_portal_user, false) AND epa.account_scope = 'individual'
          AND p.attorney_contact_id IS NOT NULL AND p.attorney_contact_id = v_assigned_attorney_contact_id
        )
      );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_missing_document_reminders() IS
  'Phase 29: one consolidated notification per claimant listing every REQUIRED_DOCUMENTS type still unsubmitted 7+ days after the claimant record was created. Re-notifies at most once every 7 days per claimant. Scheduled daily.';

DO $$
DECLARE existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'send-missing-document-reminders-daily';
  IF existing_jobid IS NOT NULL THEN PERFORM cron.unschedule(existing_jobid); END IF;
END $$;

SELECT cron.schedule(
  'send-missing-document-reminders-daily',
  '0 6 * * *',
  $$SELECT public.send_missing_document_reminders();$$
);

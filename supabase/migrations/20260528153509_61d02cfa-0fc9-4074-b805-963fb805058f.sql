
-- 1. Prevent duplicate timeline phases per appointment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_timelines_appointment_phase_unique'
  ) THEN
    -- Defensive de-dupe first (keeps earliest row per (appointment_id, phase_name))
    DELETE FROM public.case_timelines a
    USING public.case_timelines b
    WHERE a.appointment_id = b.appointment_id
      AND a.phase_name = b.phase_name
      AND a.ctid > b.ctid;

    ALTER TABLE public.case_timelines
      ADD CONSTRAINT case_timelines_appointment_phase_unique
      UNIQUE (appointment_id, phase_name);
  END IF;
END $$;

-- 2. Prevent duplicate expert_reports rows per appointment
CREATE UNIQUE INDEX IF NOT EXISTS expert_reports_appointment_unique
  ON public.expert_reports (appointment_id)
  WHERE appointment_id IS NOT NULL;

-- 3. Master → Feeder: mirror key fields from appointments into expert_reports.
--    Updates the existing expert_reports row in place; never inserts a duplicate.
CREATE OR REPLACE FUNCTION public.sync_appointment_to_expert_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on actual field changes that matter to downstream tracking.
  IF TG_OP = 'UPDATE' AND (
       NEW.report_status      IS DISTINCT FROM OLD.report_status
    OR NEW.appointment_date   IS DISTINCT FROM OLD.appointment_date
    OR NEW.expert_id          IS DISTINCT FROM OLD.expert_id
    OR NEW.case_status        IS DISTINCT FROM OLD.case_status
  ) THEN
    UPDATE public.expert_reports er
    SET
      report_status = COALESCE(NEW.report_status, er.report_status),
      expert_id     = COALESCE(NEW.expert_id,     er.expert_id),
      report_due_date = CASE
        WHEN er.report_due_date IS NULL AND NEW.appointment_date IS NOT NULL
          THEN NEW.appointment_date + INTERVAL '30 days'
        ELSE er.report_due_date
      END,
      updated_at = now()
    WHERE er.appointment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_to_expert_report ON public.appointments;
CREATE TRIGGER trg_sync_appointment_to_expert_report
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_to_expert_report();

-- 4. Master → Feeder: when an assessment is cancelled, reset its timeline phases
--    so Workflow Automation does not show a stale "in progress" step.
CREATE OR REPLACE FUNCTION public.reset_timeline_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(NEW.case_status,'')) = 'cancelled'
     AND lower(coalesce(OLD.case_status,'')) <> 'cancelled' THEN
    UPDATE public.case_timelines
    SET status = 'pending',
        started_at = NULL,
        completed_at = NULL,
        updated_at = now()
    WHERE appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_timeline_on_cancellation ON public.appointments;
CREATE TRIGGER trg_reset_timeline_on_cancellation
  AFTER UPDATE OF case_status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_timeline_on_cancellation();

CREATE OR REPLACE FUNCTION public.sync_appointment_to_expert_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- appointments has no report_status column; only react to fields that exist.
  IF TG_OP = 'UPDATE' AND (
       NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
    OR NEW.expert_id        IS DISTINCT FROM OLD.expert_id
    OR NEW.case_status      IS DISTINCT FROM OLD.case_status
  ) THEN
    UPDATE public.expert_reports er
    SET
      expert_id = COALESCE(NEW.expert_id, er.expert_id),
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
$function$;
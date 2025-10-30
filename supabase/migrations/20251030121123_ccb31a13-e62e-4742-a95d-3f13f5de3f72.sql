-- Create or replace function to handle report status updates
CREATE OR REPLACE FUNCTION public.handle_report_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appointment_record RECORD;
BEGIN
  -- Check if report status changed to a completed state
  IF (NEW.report_status IN ('completed', 'Report fully paid & submitted', 'taken_out', 'Taken Out') 
      AND (OLD.report_status IS NULL OR OLD.report_status != NEW.report_status)) THEN
    
    -- Get appointment details
    SELECT a.law_firm_id, a.id
    INTO v_appointment_record
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id;
    
    -- Log the completion in audit trail
    PERFORM public.log_audit_trail(
      'expert_reports',
      NEW.id,
      'UPDATE',
      'report_completion',
      jsonb_build_object(
        'old_status', OLD.report_status,
        'new_status', NEW.report_status
      ),
      jsonb_build_object(
        'appointment_id', NEW.appointment_id,
        'report_submitted_date', NEW.report_submitted_date,
        'law_firm_id', v_appointment_record.law_firm_id
      ),
      'Report marked as completed/delivered'
    );
    
    -- Update the report submitted date if not already set
    IF NEW.report_submitted_date IS NULL AND NEW.report_status IN ('completed', 'Report fully paid & submitted', 'taken_out', 'Taken Out') THEN
      NEW.report_submitted_date = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_report_status_update ON public.expert_reports;

-- Create trigger for report status updates
CREATE TRIGGER trigger_report_status_update
  BEFORE UPDATE ON public.expert_reports
  FOR EACH ROW
  WHEN (NEW.report_status IS DISTINCT FROM OLD.report_status)
  EXECUTE FUNCTION public.handle_report_status_update();

-- Create or replace view for dashboard completed reports statistics
CREATE OR REPLACE VIEW public.dashboard_completed_reports AS
SELECT 
  a.law_firm_id,
  COUNT(*) FILTER (WHERE er.report_status IN ('completed', 'Report fully paid & submitted', 'taken_out', 'Taken Out')) as completed_reports_count,
  COUNT(*) FILTER (WHERE er.report_status IN ('completed', 'Report fully paid & submitted', 'taken_out', 'Taken Out') 
                   AND er.report_submitted_date >= date_trunc('month', CURRENT_DATE)) as completed_this_month,
  COUNT(*) FILTER (WHERE er.report_status IN ('completed', 'Report fully paid & submitted', 'taken_out', 'Taken Out')
                   AND er.report_submitted_date >= date_trunc('year', CURRENT_DATE)) as completed_this_year,
  MAX(er.report_submitted_date) as last_completed_date
FROM public.appointments a
LEFT JOIN public.expert_reports er ON a.id = er.appointment_id
WHERE a.deleted_at IS NULL
GROUP BY a.law_firm_id;

-- Grant select permissions on the view
GRANT SELECT ON public.dashboard_completed_reports TO authenticated;

-- Create function to get completed reports for current user's law firm
CREATE OR REPLACE FUNCTION public.get_completed_reports_stats()
RETURNS TABLE(
  total_completed bigint,
  completed_this_month bigint,
  completed_this_year bigint,
  last_completed_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_law_firm_id uuid;
BEGIN
  -- Get current user's law firm
  user_law_firm_id := public.get_current_user_law_firm();
  
  -- Return stats for user's law firm or all if admin
  RETURN QUERY
  SELECT 
    dcr.completed_reports_count as total_completed,
    dcr.completed_this_month,
    dcr.completed_this_year,
    dcr.last_completed_date
  FROM public.dashboard_completed_reports dcr
  WHERE 
    (public.is_system_admin() OR dcr.law_firm_id = user_law_firm_id)
    AND dcr.law_firm_id IS NOT NULL
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.handle_report_status_update() IS 'Automatically tracks report completions and updates submission dates when report status changes to completed states';
COMMENT ON VIEW public.dashboard_completed_reports IS 'Aggregated view of completed reports statistics per law firm for dashboard display';
COMMENT ON FUNCTION public.get_completed_reports_stats() IS 'Returns completed reports statistics for the current user law firm';
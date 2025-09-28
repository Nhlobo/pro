-- Create a function to clear assessment data (admin only)
CREATE OR REPLACE FUNCTION public.clear_assessment_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  appointments_deleted integer := 0;
  expert_reports_deleted integer := 0;
  archives_deleted integer := 0;
  result_json jsonb;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required to clear assessment data.';
  END IF;

  -- Get current user's law firm
  DECLARE
    user_law_firm_id uuid;
  BEGIN
    SELECT law_firm_id INTO user_law_firm_id
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- If no law firm (main admin), clear all data
    IF user_law_firm_id IS NULL THEN
      -- Clear expert reports
      DELETE FROM public.expert_reports;
      GET DIAGNOSTICS expert_reports_deleted = ROW_COUNT;
      
      -- Clear appointments
      DELETE FROM public.appointments;
      GET DIAGNOSTICS appointments_deleted = ROW_COUNT;
      
      -- Clear assessment archives
      DELETE FROM public.assessment_report_archives;
      GET DIAGNOSTICS archives_deleted = ROW_COUNT;
    ELSE
      -- Clear expert reports for specific law firm
      DELETE FROM public.expert_reports 
      WHERE appointment_id IN (
        SELECT id FROM public.appointments 
        WHERE law_firm_id = user_law_firm_id
      );
      GET DIAGNOSTICS expert_reports_deleted = ROW_COUNT;
      
      -- Clear appointments for specific law firm
      DELETE FROM public.appointments 
      WHERE law_firm_id = user_law_firm_id;
      GET DIAGNOSTICS appointments_deleted = ROW_COUNT;
      
      -- Clear assessment archives for specific law firm
      DELETE FROM public.assessment_report_archives 
      WHERE law_firm_id = user_law_firm_id;
      GET DIAGNOSTICS archives_deleted = ROW_COUNT;
    END IF;
  END;

  -- Create result JSON
  result_json := jsonb_build_object(
    'appointments_deleted', appointments_deleted,
    'expert_reports_deleted', expert_reports_deleted,
    'archives_deleted', archives_deleted,
    'total_deleted', appointments_deleted + expert_reports_deleted + archives_deleted
  );

  -- Log the action for audit trail
  PERFORM public.log_audit_trail(
    'assessment_data',
    NULL,
    'DELETE_ALL',
    'data_management',
    NULL,
    result_json,
    'Cleared all assessment data'
  );

  RETURN result_json;
END;
$$;
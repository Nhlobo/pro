-- Fix clear_medical_experts function to handle related records
CREATE OR REPLACE FUNCTION public.clear_medical_experts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer := 0;
  expert_reports_deleted integer := 0;
  appointments_deleted integer := 0;
BEGIN
  -- Check if user is admin or employee
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'employee')
    AND created_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin or employee privileges required to clear medical experts.';
  END IF;

  -- First, delete related expert reports
  DELETE FROM public.expert_reports WHERE TRUE;
  GET DIAGNOSTICS expert_reports_deleted = ROW_COUNT;

  -- Then, delete related appointments
  DELETE FROM public.appointments WHERE TRUE;
  GET DIAGNOSTICS appointments_deleted = ROW_COUNT;

  -- Finally, delete all medical experts
  DELETE FROM public.medical_experts WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the action for audit trail with detailed information
  PERFORM public.log_audit_trail(
    'medical_experts',
    NULL,
    'DELETE_ALL',
    'expert_management',
    NULL,
    jsonb_build_object(
      'deleted_experts', deleted_count,
      'deleted_appointments', appointments_deleted,
      'deleted_expert_reports', expert_reports_deleted
    ),
    'Cleared all medical experts and related data from directory'
  );

  RETURN deleted_count;
END;
$function$;
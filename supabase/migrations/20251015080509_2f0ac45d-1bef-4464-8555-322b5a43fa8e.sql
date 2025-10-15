-- Create function to clear medical experts by province
CREATE OR REPLACE FUNCTION public.clear_medical_experts_by_province(p_province text)
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

  -- Validate province parameter
  IF p_province IS NULL OR p_province = '' THEN
    RAISE EXCEPTION 'Province parameter is required.';
  END IF;

  -- First, delete related expert reports for experts in this province
  DELETE FROM public.expert_reports 
  WHERE expert_id IN (
    SELECT id FROM public.medical_experts WHERE province = p_province
  );
  GET DIAGNOSTICS expert_reports_deleted = ROW_COUNT;

  -- Then, delete related appointments for experts in this province
  DELETE FROM public.appointments 
  WHERE expert_id IN (
    SELECT id FROM public.medical_experts WHERE province = p_province
  );
  GET DIAGNOSTICS appointments_deleted = ROW_COUNT;

  -- Finally, delete all medical experts from the specified province
  DELETE FROM public.medical_experts WHERE province = p_province;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the action for audit trail with detailed information
  PERFORM public.log_audit_trail(
    'medical_experts',
    NULL,
    'DELETE',
    'expert_management',
    NULL,
    jsonb_build_object(
      'province', p_province,
      'deleted_experts', deleted_count,
      'deleted_appointments', appointments_deleted,
      'deleted_expert_reports', expert_reports_deleted
    ),
    'Cleared all medical experts from ' || p_province
  );

  RETURN deleted_count;
END;
$function$;
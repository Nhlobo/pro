-- Create function to clear all medical experts (for admin use only)
CREATE OR REPLACE FUNCTION public.clear_medical_experts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer := 0;
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

  -- Delete all medical experts and count how many were deleted
  DELETE FROM public.medical_experts;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the action for audit trail
  PERFORM public.log_audit_trail(
    'medical_experts',
    NULL,
    'DELETE_ALL',
    'expert_management',
    NULL,
    jsonb_build_object('deleted_count', deleted_count),
    'Cleared all medical experts from directory'
  );

  RETURN deleted_count;
END;
$$;
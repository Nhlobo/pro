CREATE OR REPLACE FUNCTION public.log_audit_trail(
  p_table_name text,
  p_record_id uuid,
  p_action_type text,
  p_function_area text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  SELECT public.log_audit_trail(
    p_table_name,
    p_record_id::text,
    p_action_type,
    p_function_area,
    p_old_values,
    p_new_values,
    p_description
  ) INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;
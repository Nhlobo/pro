
-- The existing log_audit_trail returns uuid, so we must drop it first to change signature
DROP FUNCTION IF EXISTS public.log_audit_trail(text, uuid, text, text, jsonb, jsonb, text);

-- Recreate with correct signature (returns uuid) and referring_attorney_id
CREATE OR REPLACE FUNCTION public.log_audit_trail(
  p_table_name TEXT,
  p_record_id TEXT,
  p_action_type TEXT,
  p_function_area TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_id UUID;
  user_profile RECORD;
  changed_fields JSONB := '{}';
  field_key TEXT;
BEGIN
  SELECT email, referring_attorney_id INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    FOR field_key IN SELECT jsonb_object_keys(p_new_values)
    LOOP
      IF p_old_values->>field_key IS DISTINCT FROM p_new_values->>field_key THEN
        changed_fields := changed_fields || jsonb_build_object(
          field_key, 
          jsonb_build_object(
            'old', p_old_values->field_key,
            'new', p_new_values->field_key
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  INSERT INTO public.audit_logs (
    table_name, record_id, action_type, old_values, new_values,
    changed_fields, user_id, user_email, function_area, description
  ) VALUES (
    p_table_name, p_record_id, p_action_type, p_old_values, p_new_values,
    changed_fields, auth.uid(), user_profile.email, p_function_area, p_description
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

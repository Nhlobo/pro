
-- Fix the log_audit_trail function to cast record_id to UUID
CREATE OR REPLACE FUNCTION public.log_audit_trail(
  p_table_name text,
  p_record_id text,
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
  audit_id UUID;
  user_profile RECORD;
  changed_fields JSONB := '{}';
  field_key TEXT;
  safe_record_id UUID;
BEGIN
  -- Safely cast record_id to UUID
  BEGIN
    safe_record_id := p_record_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    safe_record_id := NULL;
  END;

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
    p_table_name, safe_record_id, p_action_type, p_old_values, p_new_values,
    changed_fields, auth.uid(), user_profile.email, p_function_area, p_description
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

-- Also fix the appointment_archives FK to allow cascading
ALTER TABLE public.appointment_archives DROP CONSTRAINT appointment_archives_created_by_fkey;
ALTER TABLE public.appointment_archives ADD CONSTRAINT appointment_archives_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

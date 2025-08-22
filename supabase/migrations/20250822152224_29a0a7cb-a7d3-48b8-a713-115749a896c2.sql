-- Fix remaining function search path security warnings
-- Update all remaining functions to have immutable search_path

-- Fix log_audit_trail function
CREATE OR REPLACE FUNCTION public.log_audit_trail(p_table_name text, p_record_id uuid, p_action_type text, p_function_area text, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_description text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  audit_id UUID;
  user_profile RECORD;
  changed_fields JSONB := '{}';
  field_key TEXT;
BEGIN
  -- Get user profile information
  SELECT email, law_firm_id INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Calculate changed fields if both old and new values exist
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
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action_type,
    old_values,
    new_values,
    changed_fields,
    user_id,
    user_email,
    function_area,
    description
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action_type,
    p_old_values,
    p_new_values,
    changed_fields,
    auth.uid(),
    user_profile.email,
    p_function_area,
    p_description
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$function$;

-- Fix user_has_permission function
CREATE OR REPLACE FUNCTION public.user_has_permission(permission_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions 
    WHERE user_id = auth.uid() 
    AND permission_name = $1 
    AND granted = true
  ) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$function$;

-- Fix process_edit_request function
CREATE OR REPLACE FUNCTION public.process_edit_request(p_request_id uuid, p_status approval_status, p_admin_notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only administrators can process edit requests';
  END IF;
  
  -- Update request status
  UPDATE public.edit_requests 
  SET 
    status = p_status,
    approved_by = auth.uid(),
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_request_id;
  
  RETURN FOUND;
END;
$function$;

-- Fix request_edit_permission function
CREATE OR REPLACE FUNCTION public.request_edit_permission(p_table_name text, p_record_id uuid, p_reason text, p_requested_changes jsonb, p_original_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_id UUID;
BEGIN
  -- Check if user already has a pending request for this record
  IF EXISTS (
    SELECT 1 FROM public.edit_requests 
    WHERE table_name = p_table_name 
    AND record_id = p_record_id 
    AND requested_by = auth.uid()
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Edit request already exists for this record';
  END IF;
  
  -- Create edit request
  INSERT INTO public.edit_requests (
    table_name,
    record_id,
    requested_by,
    request_reason,
    requested_changes,
    original_data
  ) VALUES (
    p_table_name,
    p_record_id,
    auth.uid(),
    p_reason,
    p_requested_changes,
    p_original_data
  ) RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$function$;
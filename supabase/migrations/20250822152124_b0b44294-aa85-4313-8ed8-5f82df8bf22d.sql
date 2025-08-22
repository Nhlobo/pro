-- Fix function search path security warning
-- Update functions to have immutable search_path for security

-- Fix log_sensitive_data_access function
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(accessed_table text, accessed_record_id uuid, access_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action_type,
    user_id,
    function_area,
    description,
    user_email
  ) VALUES (
    accessed_table,
    accessed_record_id,
    access_type,
    auth.uid(),
    'security_audit',
    'Sensitive data access logged for security monitoring',
    (SELECT email FROM public.profiles WHERE id = auth.uid())
  );
END;
$function$;

-- Fix mask_sensitive_data function
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(data_type text, original_value text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE data_type
    WHEN 'email' THEN 
      CASE 
        WHEN original_value IS NULL THEN NULL
        WHEN position('@' in original_value) > 0 THEN
          LEFT(original_value, 2) || '***@' || SPLIT_PART(original_value, '@', 2)
        ELSE '***'
      END
    WHEN 'phone' THEN
      CASE
        WHEN original_value IS NULL THEN NULL
        WHEN LENGTH(original_value) > 6 THEN
          LEFT(original_value, 3) || '***' || RIGHT(original_value, 3)
        ELSE '***'
      END
    WHEN 'address' THEN
      CASE
        WHEN original_value IS NULL THEN NULL
        WHEN LENGTH(original_value) > 10 THEN
          LEFT(original_value, 5) || '...[Protected]'
        ELSE '[Protected]'
      END
    ELSE '[Protected]'
  END;
$function$;

-- Fix validate_user_session function
CREATE OR REPLACE FUNCTION public.validate_user_session()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
BEGIN
  -- Validate current user session and profile
  SELECT id, role, law_firm_id, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Ensure user profile exists and is valid
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure user has a valid creation date (not a fake account)
  IF user_profile.created_at IS NULL OR user_profile.created_at > NOW() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;
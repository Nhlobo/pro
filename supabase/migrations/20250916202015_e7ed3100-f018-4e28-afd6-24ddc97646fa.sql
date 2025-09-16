-- Security Enhancement: Remove hardcoded admin dependencies and strengthen functions

-- Update the can_view_expert_contacts function to be more restrictive
CREATE OR REPLACE FUNCTION public.can_view_expert_contacts(expert_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  -- Admin users can see all contact details
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR 
  -- Users can see contact details ONLY for experts they have active appointments with
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE expert_id = $1 
    AND law_firm_id = public.get_current_user_law_firm()
    AND case_status IN ('scheduled', 'in_progress', 'completed')
  );
$function$;

-- Update mask_sensitive_data to be more secure
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(data_type text, original_value text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT CASE data_type
    WHEN 'email' THEN 
      CASE 
        WHEN original_value IS NULL THEN NULL
        WHEN position('@' in original_value) > 0 THEN
          LEFT(original_value, 1) || '****@' || SPLIT_PART(original_value, '@', 2)
        ELSE '****'
      END
    WHEN 'phone' THEN
      CASE
        WHEN original_value IS NULL THEN NULL
        WHEN LENGTH(original_value) > 6 THEN
          LEFT(original_value, 2) || '****' || RIGHT(original_value, 2)
        ELSE '****'
      END
    WHEN 'address' THEN
      CASE
        WHEN original_value IS NULL THEN NULL
        WHEN LENGTH(original_value) > 15 THEN
          LEFT(original_value, 3) || '...[Protected Address]'
        ELSE '[Protected Address]'
      END
    ELSE '[Protected Data]'
  END;
$function$;

-- Add enhanced audit logging for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(accessed_table text, accessed_record_id uuid, access_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Log with IP and user agent if available
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action_type,
    user_id,
    function_area,
    description,
    user_email,
    ip_address,
    user_agent
  ) VALUES (
    accessed_table,
    accessed_record_id,
    access_type,
    auth.uid(),
    'security_audit',
    'Sensitive data access logged - ' || access_type,
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'),
    coalesce(current_setting('request.headers', true)::json->>'user-agent', 'unknown')
  );
END;
$function$;

-- Ensure all security definer functions have proper search_path
CREATE OR REPLACE FUNCTION public.is_system_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR user_type = 'admin')
    AND created_at IS NOT NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_law_firm()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT law_firm_id 
  FROM public.profiles 
  WHERE id = auth.uid() 
  AND law_firm_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.law_firms lf 
    WHERE lf.id = profiles.law_firm_id
  );
$function$;

-- Fix log_audit_trail: replace law_firm_id with referring_attorney_id
CREATE OR REPLACE FUNCTION public.log_audit_trail(
  p_table_name TEXT,
  p_record_id TEXT,
  p_action_type TEXT,
  p_function_area TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
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

-- Fix validate_user_session: replace law_firm_id with referring_attorney_id
CREATE OR REPLACE FUNCTION public.validate_user_session()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  SELECT id, role, referring_attorney_id, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF user_profile.created_at IS NULL OR user_profile.created_at > NOW() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Fix validate_law_firm_access_secure: replace law_firm_id with referring_attorney_id
CREATE OR REPLACE FUNCTION public.validate_law_firm_access_secure(target_law_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  IF target_law_firm_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT id, referring_attorney_id, role, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL;
  
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF user_profile.role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  RETURN (user_profile.referring_attorney_id = target_law_firm_id);
END;
$$;

-- Fix log_security_event: replace law_firm_id with referring_attorney_id
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_resource_type TEXT,
  p_action TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_risk_level TEXT DEFAULT 'low'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_id uuid;
  user_profile RECORD;
  client_info jsonb := '{}';
BEGIN
  SELECT id, email, role, referring_attorney_id INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  client_info := jsonb_build_object(
    'ip_address', coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'),
    'user_agent', coalesce(current_setting('request.headers', true)::json->>'user-agent', 'unknown'),
    'timestamp', now(),
    'risk_level', p_risk_level
  );
  
  INSERT INTO public.audit_logs (
    table_name, record_id, action_type, user_id, user_email,
    function_area, description, new_values, ip_address, user_agent
  ) VALUES (
    p_resource_type, p_resource_id, p_action, auth.uid(), user_profile.email,
    'security_compliance',
    format('Security Event: %s - %s', p_event_type, p_action),
    jsonb_build_object('event_type', p_event_type, 'details', p_details, 'client_info', client_info),
    client_info->>'ip_address',
    client_info->>'user_agent'
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

-- Fix can_access_pii: replace law_firm_id with referring_attorney_id
CREATE OR REPLACE FUNCTION public.can_access_pii(target_user_id UUID, data_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_profile RECORD;
  target_user_profile RECORD;
BEGIN
  IF target_user_id IS NULL OR data_type IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT id, role, referring_attorney_id INTO current_user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF current_user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF current_user_profile.role = 'admin' THEN
    PERFORM public.log_security_event('pii_access', 'user_data', 'admin_pii_access', target_user_id::text, 
      jsonb_build_object('data_type', data_type, 'target_user', target_user_id), 'medium');
    RETURN TRUE;
  END IF;
  
  SELECT referring_attorney_id INTO target_user_profile
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF current_user_profile.referring_attorney_id = target_user_profile.referring_attorney_id AND 
     current_user_profile.referring_attorney_id IS NOT NULL THEN
    PERFORM public.log_security_event('pii_access', 'user_data', 'lawfirm_pii_access', target_user_id::text,
      jsonb_build_object('data_type', data_type), 'low');
    RETURN TRUE;
  END IF;
  
  PERFORM public.log_security_event('unauthorized_access_attempt', 'user_data', 'pii_access_denied', target_user_id::text,
    jsonb_build_object('data_type', data_type, 'reason', 'insufficient_permissions'), 'high');
  
  RETURN FALSE;
END;
$$;

-- Fix get_user_law_firm_secure: replace law_firm_id with referring_attorney_id
CREATE OR REPLACE FUNCTION public.get_user_law_firm_secure()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_law_firm_id uuid;
BEGIN
  SELECT referring_attorney_id INTO user_law_firm_id
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL;
  
  RETURN user_law_firm_id;
END;
$$;

-- Fix check_user_role: replace law_firm_id with referring_attorney_id
CREATE OR REPLACE FUNCTION public.check_user_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  IF required_role IS NULL OR required_role = '' THEN
    RETURN FALSE;
  END IF;
  
  SELECT id, role, user_type, referring_attorney_id, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL 
    AND created_at <= now();
  
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN (user_profile.role = required_role OR user_profile.user_type = required_role);
END;
$$;

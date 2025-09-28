-- ============================================================================
-- PART 2: DATA MASKING AND PII PROTECTION FUNCTIONS
-- ============================================================================

-- Enhanced data masking with compliance standards - Fixed parameters
CREATE OR REPLACE FUNCTION public.mask_pii_data(
  data_type text, 
  original_value text, 
  access_level text DEFAULT 'basic'
)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Input validation
  IF original_value IS NULL OR original_value = '' THEN
    RETURN NULL;
  END IF;
  
  -- Full access for admins
  IF access_level = 'full' OR public.is_admin_secure() THEN
    RETURN original_value;
  END IF;
  
  CASE data_type
    WHEN 'email' THEN
      IF position('@' in original_value) > 0 THEN
        RETURN LEFT(original_value, 2) || '****@' || SPLIT_PART(original_value, '@', 2);
      ELSE
        RETURN '[PROTECTED EMAIL]';
      END IF;
    WHEN 'phone' THEN
      IF LENGTH(original_value) > 6 THEN
        RETURN LEFT(original_value, 3) || '****' || RIGHT(original_value, 2);
      ELSE
        RETURN '[PROTECTED PHONE]';
      END IF;
    WHEN 'address' THEN
      RETURN '[PROTECTED ADDRESS]';
    WHEN 'name' THEN
      IF LENGTH(original_value) > 3 THEN
        RETURN LEFT(original_value, 1) || REPEAT('*', LENGTH(original_value) - 2) || RIGHT(original_value, 1);
      ELSE
        RETURN '[PROTECTED NAME]';
      END IF;
    WHEN 'id_number' THEN
      RETURN '[PROTECTED ID]';
    ELSE
      RETURN '[PROTECTED DATA]';
  END CASE;
END;
$$;

-- ============================================================================
-- PART 3: ENHANCED AUDIT LOGGING FOR COMPLIANCE
-- ============================================================================

-- Comprehensive audit logging function - Fixed parameters
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_resource_type text,
  p_action text,
  p_resource_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_risk_level text DEFAULT 'low'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  audit_id uuid;
  user_profile RECORD;
  client_info jsonb := '{}';
BEGIN
  -- Get user information
  SELECT id, email, role, law_firm_id INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Build client information
  client_info := jsonb_build_object(
    'ip_address', coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'),
    'user_agent', coalesce(current_setting('request.headers', true)::json->>'user-agent', 'unknown'),
    'timestamp', now(),
    'risk_level', p_risk_level
  );
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action_type,
    user_id,
    user_email,
    function_area,
    description,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    p_resource_type,
    p_resource_id,
    p_action,
    auth.uid(),
    user_profile.email,
    'security_compliance',
    format('Security Event: %s - %s', p_event_type, p_action),
    jsonb_build_object(
      'event_type', p_event_type,
      'details', p_details,
      'client_info', client_info
    ),
    client_info->>'ip_address',
    client_info->>'user_agent'
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
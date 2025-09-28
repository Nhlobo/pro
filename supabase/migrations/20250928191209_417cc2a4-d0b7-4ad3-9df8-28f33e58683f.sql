-- ============================================================================
-- PART 4: DATA ACCESS CONTROL AND PII PROTECTION
-- ============================================================================

-- Secure function to check PII access permissions
CREATE OR REPLACE FUNCTION public.can_access_pii(target_user_id uuid, data_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_profile RECORD;
  target_user_profile RECORD;
BEGIN
  -- Input validation
  IF target_user_id IS NULL OR data_type IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get current user profile
  SELECT id, role, law_firm_id INTO current_user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- User must be authenticated
  IF current_user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admins can access all PII (with audit logging)
  IF current_user_profile.role = 'admin' THEN
    PERFORM public.log_security_event('pii_access', 'user_data', 'admin_pii_access', target_user_id, 
      jsonb_build_object('data_type', data_type, 'target_user', target_user_id), 'medium');
    RETURN TRUE;
  END IF;
  
  -- Get target user profile
  SELECT law_firm_id INTO target_user_profile
  FROM public.profiles 
  WHERE id = target_user_id;
  
  -- Users can access PII within their law firm only
  IF current_user_profile.law_firm_id = target_user_profile.law_firm_id AND 
     current_user_profile.law_firm_id IS NOT NULL THEN
    PERFORM public.log_security_event('pii_access', 'user_data', 'lawfirm_pii_access', target_user_id,
      jsonb_build_object('data_type', data_type), 'low');
    RETURN TRUE;
  END IF;
  
  -- Log unauthorized access attempt
  PERFORM public.log_security_event('unauthorized_access_attempt', 'user_data', 'pii_access_denied', target_user_id,
    jsonb_build_object('data_type', data_type, 'reason', 'insufficient_permissions'), 'high');
  
  RETURN FALSE;
END;
$$;

-- ============================================================================
-- PART 5: COMPLIANCE MONITORING AND DATA RETENTION
-- ============================================================================

-- Function to check data retention compliance
CREATE OR REPLACE FUNCTION public.check_data_retention_compliance()
RETURNS TABLE(
  table_name text,
  record_count bigint,
  oldest_record timestamp with time zone,
  compliance_status text,
  action_required text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  retention_period interval := '7 years';
  warning_period interval := '6 years';
BEGIN
  -- Only admins can run compliance checks
  IF NOT public.is_admin_secure() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required for compliance checks.';
  END IF;
  
  -- Log compliance check
  PERFORM public.log_security_event('compliance_check', 'system', 'data_retention_check', NULL, NULL, 'low');
  
  -- Check appointments table
  RETURN QUERY
  SELECT 
    'appointments'::text,
    COUNT(*)::bigint,
    MIN(created_at),
    CASE 
      WHEN MIN(created_at) < (now() - retention_period) THEN 'NON_COMPLIANT'
      WHEN MIN(created_at) < (now() - warning_period) THEN 'WARNING'
      ELSE 'COMPLIANT'
    END,
    CASE 
      WHEN MIN(created_at) < (now() - retention_period) THEN 'Archive or delete old records immediately'
      WHEN MIN(created_at) < (now() - warning_period) THEN 'Plan archival process'
      ELSE 'No action required'
    END
  FROM public.appointments
  WHERE created_at IS NOT NULL;
END;
$$;

-- Security definer function to get user law firm securely
CREATE OR REPLACE FUNCTION public.get_user_law_firm_secure()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_law_firm_id uuid;
BEGIN
  SELECT law_firm_id INTO user_law_firm_id
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL;
  
  RETURN user_law_firm_id;
END;
$$;
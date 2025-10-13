-- Create time-limited access tokens for sensitive data
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('medical_expert', 'claimant', 'law_firm', 'document')),
  resource_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES auth.users(id),
  CONSTRAINT token_expiry_future CHECK (expires_at > created_at)
);

-- Index for fast token validation
CREATE INDEX idx_access_tokens_hash ON public.sensitive_data_access_tokens(token_hash) WHERE NOT revoked;
CREATE INDEX idx_access_tokens_expiry ON public.sensitive_data_access_tokens(expires_at) WHERE NOT revoked;
CREATE INDEX idx_access_tokens_user ON public.sensitive_data_access_tokens(user_id);

-- Enable RLS
ALTER TABLE public.sensitive_data_access_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own tokens"
ON public.sensitive_data_access_tokens FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all tokens"
ON public.sensitive_data_access_tokens FOR SELECT
USING (is_system_admin());

CREATE POLICY "System can insert tokens"
ON public.sensitive_data_access_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can revoke tokens"
ON public.sensitive_data_access_tokens FOR UPDATE
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Function to generate time-limited access token
CREATE OR REPLACE FUNCTION public.generate_access_token(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(token TEXT, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Validate input
  IF p_resource_type NOT IN ('medical_expert', 'claimant', 'law_firm', 'document') THEN
    RAISE EXCEPTION 'Invalid resource type';
  END IF;
  
  IF p_duration_minutes < 1 OR p_duration_minutes > 1440 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 1440 minutes (24 hours)';
  END IF;
  
  -- Generate random token
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Store token
  INSERT INTO public.sensitive_data_access_tokens (
    user_id,
    resource_type,
    resource_id,
    token_hash,
    expires_at
  ) VALUES (
    auth.uid(),
    p_resource_type,
    p_resource_id,
    v_token_hash,
    v_expires_at
  );
  
  -- Log token generation
  PERFORM log_audit_trail(
    'sensitive_data_access_tokens',
    p_resource_id,
    'CREATE',
    'security',
    NULL,
    jsonb_build_object(
      'resource_type', p_resource_type,
      'expires_at', v_expires_at,
      'duration_minutes', p_duration_minutes
    ),
    'Generated time-limited access token'
  );
  
  RETURN QUERY SELECT v_token, v_expires_at;
END;
$$;

-- Function to validate access token
CREATE OR REPLACE FUNCTION public.validate_access_token(
  p_token TEXT,
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_valid BOOLEAN;
BEGIN
  -- Hash the provided token
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  
  -- Check if token exists, is valid, not revoked, and not expired
  SELECT EXISTS (
    SELECT 1 FROM public.sensitive_data_access_tokens
    WHERE token_hash = v_token_hash
      AND resource_type = p_resource_type
      AND resource_id = p_resource_id
      AND user_id = auth.uid()
      AND NOT revoked
      AND expires_at > now()
  ) INTO v_valid;
  
  -- Update access tracking if valid
  IF v_valid THEN
    UPDATE public.sensitive_data_access_tokens
    SET accessed_at = now(),
        access_count = access_count + 1
    WHERE token_hash = v_token_hash;
  END IF;
  
  RETURN v_valid;
END;
$$;

-- Function to revoke access token
CREATE OR REPLACE FUNCTION public.revoke_access_token(
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  
  UPDATE public.sensitive_data_access_tokens
  SET revoked = true,
      revoked_at = now(),
      revoked_by = auth.uid()
  WHERE token_hash = v_token_hash
    AND (user_id = auth.uid() OR is_system_admin());
  
  RETURN FOUND;
END;
$$;

-- Cleanup expired tokens (to be run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.sensitive_data_access_tokens
  WHERE expires_at < now() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  PERFORM log_audit_trail(
    'sensitive_data_access_tokens',
    NULL,
    'DELETE',
    'security',
    NULL,
    jsonb_build_object('deleted_count', v_deleted_count),
    'Cleaned up expired access tokens'
  );
  
  RETURN v_deleted_count;
END;
$$;

-- 2FA Enforcement Functions
CREATE OR REPLACE FUNCTION public.require_2fa_for_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_has_2fa BOOLEAN;
BEGIN
  -- Check if user is admin
  v_is_admin := is_system_admin();
  
  IF NOT v_is_admin THEN
    RETURN true; -- Non-admins don't need 2FA for this check
  END IF;
  
  -- Check if admin has 2FA enabled
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = auth.uid()
      AND status = 'verified'
  ) INTO v_has_2fa;
  
  IF NOT v_has_2fa THEN
    RAISE EXCEPTION 'Two-factor authentication is required for admin operations';
  END IF;
  
  RETURN true;
END;
$$;

-- Security Audit Functions
CREATE TABLE IF NOT EXISTS public.security_audit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  audit_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  finding_category TEXT NOT NULL,
  finding_title TEXT NOT NULL,
  finding_details TEXT,
  affected_object TEXT,
  remediation_steps TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE public.security_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit results"
ON public.security_audit_results FOR ALL
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Create index
CREATE INDEX idx_audit_results_date ON public.security_audit_results(audit_date DESC);
CREATE INDEX idx_audit_results_status ON public.security_audit_results(status);
CREATE INDEX idx_audit_results_severity ON public.security_audit_results(severity);

-- Function to audit RLS policies
CREATE OR REPLACE FUNCTION public.audit_rls_policies()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count INTEGER,
  has_select_policy BOOLEAN,
  has_insert_policy BOOLEAN,
  has_update_policy BOOLEAN,
  has_delete_policy BOOLEAN,
  severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can run security audits
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Admin privileges required for security audit';
  END IF;
  
  RETURN QUERY
  WITH table_policies AS (
    SELECT 
      t.tablename,
      COALESCE(t.rowsecurity, false) as rls_enabled,
      COUNT(p.policyname) as policy_count,
      COUNT(p.policyname) FILTER (WHERE p.cmd = 'SELECT') > 0 as has_select,
      COUNT(p.policyname) FILTER (WHERE p.cmd = 'INSERT') > 0 as has_insert,
      COUNT(p.policyname) FILTER (WHERE p.cmd = 'UPDATE') > 0 as has_update,
      COUNT(p.policyname) FILTER (WHERE p.cmd = 'DELETE') > 0 as has_delete
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
    WHERE t.schemaname = 'public'
      AND t.tablename NOT LIKE 'pg_%'
    GROUP BY t.tablename, t.rowsecurity
  )
  SELECT 
    tp.tablename,
    tp.rls_enabled,
    tp.policy_count::INTEGER,
    tp.has_select,
    tp.has_insert,
    tp.has_update,
    tp.has_delete,
    CASE
      WHEN NOT tp.rls_enabled THEN 'critical'
      WHEN tp.policy_count = 0 THEN 'error'
      WHEN NOT (tp.has_select AND tp.has_insert AND tp.has_update AND tp.has_delete) THEN 'warn'
      ELSE 'info'
    END::TEXT as severity
  FROM table_policies tp
  ORDER BY 
    CASE
      WHEN NOT tp.rls_enabled THEN 1
      WHEN tp.policy_count = 0 THEN 2
      ELSE 3
    END,
    tp.tablename;
END;
$$;

-- Function to check for security definer functions without search_path
CREATE OR REPLACE FUNCTION public.audit_security_definer_functions()
RETURNS TABLE(
  function_name TEXT,
  has_search_path BOOLEAN,
  severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Admin privileges required for security audit';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.proname::TEXT,
    (p.proconfig IS NOT NULL AND 'search_path' = ANY(p.proconfig))::BOOLEAN as has_search_path,
    CASE
      WHEN p.prosecdef AND (p.proconfig IS NULL OR NOT 'search_path' = ANY(p.proconfig)) THEN 'error'
      ELSE 'info'
    END::TEXT as severity
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
  ORDER BY p.proname;
END;
$$;

-- Function to run comprehensive security audit
CREATE OR REPLACE FUNCTION public.run_security_audit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_rls_issues INTEGER;
  v_function_issues INTEGER;
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Admin privileges required for security audit';
  END IF;
  
  -- Count RLS issues
  SELECT COUNT(*) INTO v_rls_issues
  FROM audit_rls_policies()
  WHERE severity IN ('error', 'critical');
  
  -- Count function issues
  SELECT COUNT(*) INTO v_function_issues
  FROM audit_security_definer_functions()
  WHERE severity = 'error';
  
  -- Build result
  v_result := jsonb_build_object(
    'audit_timestamp', now(),
    'rls_issues', v_rls_issues,
    'function_issues', v_function_issues,
    'total_issues', v_rls_issues + v_function_issues
  );
  
  -- Log audit execution
  PERFORM log_audit_trail(
    'security_audit',
    NULL,
    'SELECT',
    'security',
    NULL,
    v_result,
    'Executed comprehensive security audit'
  );
  
  RETURN v_result;
END;
$$;
-- ============================================================================
-- COMPREHENSIVE SECURITY & COMPLIANCE FRAMEWORK - FIXED PARAMETERS
-- Implementing secure role-based access control with regulatory compliance
-- ============================================================================

-- 1. CREATE ENHANCED SECURITY FUNCTIONS WITH PROPER SEARCH PATH
-- ============================================================================

-- Enhanced role checking function with proper security
CREATE OR REPLACE FUNCTION public.check_user_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Validate input
  IF required_role IS NULL OR required_role = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Get user profile with validation
  SELECT id, role, user_type, law_firm_id, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL 
    AND created_at <= now();
  
  -- User must exist and have valid profile
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check role match
  RETURN (user_profile.role = required_role OR user_profile.user_type = required_role);
END;
$$;

-- Enhanced admin checking function
CREATE OR REPLACE FUNCTION public.is_admin_secure()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.check_user_role('admin');
END;
$$;

-- Enhanced law firm access validation
CREATE OR REPLACE FUNCTION public.validate_law_firm_access_secure(target_law_firm_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Input validation
  IF target_law_firm_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get current user profile
  SELECT id, law_firm_id, role, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL;
  
  -- User must exist
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin users have access to all law firms
  IF user_profile.role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Regular users can only access their own law firm
  RETURN (user_profile.law_firm_id = target_law_firm_id);
END;
$$;
-- Enhanced security for claimants table - Protecting client PII (Fixed)
-- Drop existing policies to replace with more secure ones
DROP POLICY IF EXISTS "Ultra secure claimant access" ON public.claimants;
DROP POLICY IF EXISTS "Users can only create claimants for their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can only update claimants from their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can only delete claimants from their law firm" ON public.claimants;

-- Create enhanced security function for claimant access validation
CREATE OR REPLACE FUNCTION public.validate_claimant_access(claimant_law_firm_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get current user profile with validation
  SELECT id, law_firm_id, role, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL 
    AND created_at <= now();
  
  -- Strict validation: user must exist and have valid profile
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin users have access to all claimants
  IF user_profile.role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Regular users can only access claimants from their law firm
  -- with strict validation
  IF user_profile.law_firm_id IS NOT NULL 
     AND user_profile.law_firm_id = claimant_law_firm_id 
     AND claimant_law_firm_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Create ultra-secure RLS policies for claimants table
CREATE POLICY "Secure claimant SELECT access"
ON public.claimants
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND public.validate_claimant_access(law_firm_id)
);

CREATE POLICY "Secure claimant INSERT access"
ON public.claimants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND public.validate_claimant_access(law_firm_id)
  AND law_firm_id = public.get_current_user_law_firm()
);

CREATE POLICY "Secure claimant UPDATE access"
ON public.claimants
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND public.validate_claimant_access(law_firm_id)
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND public.validate_claimant_access(law_firm_id)
  AND law_firm_id = public.get_current_user_law_firm()
);

CREATE POLICY "Secure claimant DELETE access"
ON public.claimants
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND public.validate_claimant_access(law_firm_id)
  AND (
    -- Only admins or users within 30 days can delete
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR created_at > (now() - INTERVAL '30 days')
  )
);

-- Create function to get claimants with enhanced security and audit logging
CREATE OR REPLACE FUNCTION public.get_claimants_secure()
RETURNS TABLE(
  id uuid,
  auto_id text,
  first_name_masked text,
  last_name_masked text,
  contact_number_masked text,
  law_firm_id uuid,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id,
    c.auto_id,
    -- Admin users see real data, others see masked data based on role
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.first_name 
      ELSE public.mask_sensitive_data('address', c.first_name)
    END as first_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.last_name 
      ELSE public.mask_sensitive_data('address', c.last_name)
    END as last_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.contact_number 
      ELSE public.mask_sensitive_data('phone', c.contact_number)
    END as contact_number_masked,
    c.law_firm_id,
    c.created_at
  FROM public.claimants c
  WHERE public.validate_claimant_access(c.law_firm_id)
  ORDER BY c.created_at DESC;
$$;

-- Create function for secure single claimant access with audit logging
CREATE OR REPLACE FUNCTION public.get_claimant_secure(claimant_id uuid)
RETURNS TABLE(
  id uuid,
  auto_id text,
  first_name_masked text,
  last_name_masked text,
  contact_number_masked text,
  law_firm_id uuid,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Log the access attempt for audit trail
  SELECT public.log_sensitive_data_access('claimants', $1, 'claimant_pii_access');
  
  SELECT 
    c.id,
    c.auto_id,
    -- Admin users see real data, others see masked data
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.first_name 
      ELSE public.mask_sensitive_data('address', c.first_name)
    END as first_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.last_name 
      ELSE public.mask_sensitive_data('address', c.last_name)
    END as last_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.contact_number 
      ELSE public.mask_sensitive_data('phone', c.contact_number)
    END as contact_number_masked,
    c.law_firm_id,
    c.created_at
  FROM public.claimants c
  WHERE c.id = $1 
    AND public.validate_claimant_access(c.law_firm_id);
$$;

-- Add additional constraints to prevent data exposure
ALTER TABLE public.claimants 
ADD CONSTRAINT check_law_firm_id_not_null 
CHECK (law_firm_id IS NOT NULL);

-- Add constraint to prevent empty names (PII fields should not be empty)
ALTER TABLE public.claimants 
ADD CONSTRAINT check_first_name_not_empty 
CHECK (first_name IS NOT NULL AND LENGTH(TRIM(first_name)) > 0);

ALTER TABLE public.claimants 
ADD CONSTRAINT check_last_name_not_empty 
CHECK (last_name IS NOT NULL AND LENGTH(TRIM(last_name)) > 0);

-- Comment on table for security documentation
COMMENT ON TABLE public.claimants IS 'Contains sensitive client PII data. Access is strictly controlled through RLS policies with enhanced validation functions. Use get_claimants_secure() or get_claimant_secure() functions for secure data access with audit logging.';
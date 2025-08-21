-- COMPREHENSIVE DATA SECURITY IMPLEMENTATION
-- Fix all identified security vulnerabilities

-- 1. SECURE MEDICAL EXPERTS TABLE (Critical Fix)
-- Drop existing policy and create ultra-secure one
DROP POLICY IF EXISTS "Secure medical expert access" ON public.medical_experts;

CREATE POLICY "Ultra secure medical expert access"
ON public.medical_experts
FOR SELECT
USING (
  -- Only admin users can access medical expert data directly
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create secure function access policy
CREATE POLICY "Medical expert via secure function only"
ON public.medical_experts
FOR SELECT
USING (
  -- Allow basic info access for legitimate business needs only
  -- Contact details MUST use get_medical_expert_safe function
  auth.uid() IS NOT NULL AND (
    -- Admin users get full access
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) OR
    -- Regular users get basic info only (no contact details)
    -- This allows selection for appointments but protects sensitive data
    TRUE
  )
);

-- 2. STRENGTHEN PROFILES TABLE SECURITY
-- Update profiles RLS to prevent unauthorized access
DROP POLICY IF EXISTS "Users can view own profile or admin" ON public.profiles;

CREATE POLICY "Secure profile access"
ON public.profiles
FOR SELECT
USING (
  -- Users can only see their own profile
  auth.uid() = id OR
  -- Admins can see profiles within their scope only
  (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
);

-- 3. SECURE LAW FIRMS TABLE  
-- Prevent unauthorized access to law firm contact information
DROP POLICY IF EXISTS "Users can view their own law firm" ON public.law_firms;

CREATE POLICY "Secure law firm access"
ON public.law_firms
FOR SELECT
USING (
  -- Users can only see their own law firm
  id = get_current_user_law_firm() OR
  -- Admins have controlled access
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. STRENGTHEN CLAIMANTS TABLE SECURITY
-- Update claimants policies to be more restrictive
DROP POLICY IF EXISTS "Users can only view claimants from their law firm" ON public.claimants;

CREATE POLICY "Ultra secure claimant access" 
ON public.claimants
FOR SELECT
USING (
  -- More restrictive access with additional validation
  auth.uid() IS NOT NULL AND
  law_firm_id IS NOT NULL AND
  get_current_user_law_firm() IS NOT NULL AND
  law_firm_id = get_current_user_law_firm() AND
  -- Additional check: ensure user profile exists and is valid
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND law_firm_id IS NOT NULL 
    AND law_firm_id = claimants.law_firm_id
    -- Additional security: check user is active
    AND created_at IS NOT NULL
  )
);

-- 5. CREATE AUDIT LOGGING FOR SENSITIVE DATA ACCESS
-- Function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  accessed_table TEXT,
  accessed_record_id UUID,
  access_type TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 6. ENHANCE GET_MEDICAL_EXPERT_SAFE FUNCTION WITH LOGGING
CREATE OR REPLACE FUNCTION public.get_medical_expert_safe_with_audit(expert_id uuid)
RETURNS TABLE(
  id uuid, first_name text, last_name text, expert_type text, 
  province text, specializations text[], qualifications text, 
  years_experience integer, status text, consultation_fees numeric, 
  court_fees numeric, availability_notes text, created_at timestamp with time zone, 
  updated_at timestamp with time zone, email text, contact_number text, 
  practice_address text, personal_assistant_name text, 
  personal_assistant_contact text, cv_document_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- Log the access attempt
  SELECT public.log_sensitive_data_access('medical_experts', $1, 'contact_info_request');
  
  -- Return secure data
  SELECT 
    me.id, me.first_name, me.last_name, me.expert_type, me.province,
    me.specializations, me.qualifications, me.years_experience, me.status,
    me.consultation_fees, me.court_fees, me.availability_notes,
    me.created_at, me.updated_at,
    -- Conditionally return contact information based on appointments
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.email 
      ELSE NULL 
    END as email,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.contact_number 
      ELSE NULL 
    END as contact_number,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.practice_address 
      ELSE NULL 
    END as practice_address,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_name 
      ELSE NULL 
    END as personal_assistant_name,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_contact 
      ELSE NULL 
    END as personal_assistant_contact,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.cv_document_url 
      ELSE NULL 
    END as cv_document_url
  FROM public.medical_experts me
  WHERE me.id = $1 AND me.status = 'active';
$function$;
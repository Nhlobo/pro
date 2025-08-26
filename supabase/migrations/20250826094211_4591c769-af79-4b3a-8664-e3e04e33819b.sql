-- Strengthen RLS policies for medical_experts table to prevent data harvesting

-- Drop existing policies to recreate them with stronger security
DROP POLICY IF EXISTS "Admins can view all medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Admins can create medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Only admins can update medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Only admins can delete medical experts" ON public.medical_experts;

-- Create comprehensive RLS policies with explicit restrictions

-- 1. Block all anonymous access completely
CREATE POLICY "Block anonymous access to medical experts" 
ON public.medical_experts 
FOR ALL 
TO anon 
USING (false);

-- 2. Admin-only policies with strict validation
CREATE POLICY "Admin full access to medical experts" 
ON public.medical_experts 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::text 
    AND created_at IS NOT NULL
    AND created_at <= now()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::text 
    AND created_at IS NOT NULL
    AND created_at <= now()
  )
);

-- 3. Explicit deny policy for non-admin authenticated users trying direct access
CREATE POLICY "Deny direct access to non-admin users" 
ON public.medical_experts 
FOR SELECT 
TO authenticated
USING (
  -- Only allow if user is admin OR accessing through secure functions
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::text
  )
);

-- 4. Strengthen the security functions with better search_path settings
CREATE OR REPLACE FUNCTION public.get_medical_experts_secure()
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  expert_type text,
  province text,
  specializations text[],
  qualifications text,
  years_experience integer,
  status text,
  consultation_fees numeric,
  court_fees numeric,
  availability_notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email_masked text,
  phone_masked text,
  address_masked text,
  pa_name_masked text,
  pa_phone_masked text,
  cv_document_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Log access attempt for security monitoring
  SELECT public.log_sensitive_data_access('medical_experts', null, 'bulk_expert_access');
  
  SELECT 
    me.id,
    me.first_name,
    me.last_name,
    me.expert_type,
    me.province,
    me.specializations,
    me.qualifications,
    me.years_experience,
    me.status,
    me.consultation_fees,
    me.court_fees,
    me.availability_notes,
    me.created_at,
    me.updated_at,
    -- Return masked or full data based on admin status and appointments
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.email
      ELSE public.mask_sensitive_data('email', me.email)
    END as email_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.contact_number
      ELSE public.mask_sensitive_data('phone', me.contact_number)
    END as phone_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.practice_address
      ELSE public.mask_sensitive_data('address', me.practice_address)
    END as address_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_name
      ELSE public.mask_sensitive_data('address', me.personal_assistant_name)
    END as pa_name_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_contact
      ELSE public.mask_sensitive_data('phone', me.personal_assistant_contact)
    END as pa_phone_masked,
    -- CV document is only accessible to admins or users with appointments
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.cv_document_url
      ELSE NULL
    END as cv_document_url
  FROM public.medical_experts me
  WHERE me.status = 'active'
    AND (
      -- Admin users can see all experts
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      OR
      -- Regular users can only see experts they have appointments with via their law firm
      EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.expert_id = me.id 
        AND a.law_firm_id = public.get_current_user_law_firm()
      )
    )
  ORDER BY me.province, me.last_name;
$$;

-- 5. Create a secure function for basic expert info (name and type only)
CREATE OR REPLACE FUNCTION public.get_medical_experts_basic()
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  expert_type text,
  province text,
  status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- This function provides only basic, non-sensitive information
  SELECT 
    me.id,
    me.first_name,
    me.last_name,
    me.expert_type,
    me.province,
    me.status
  FROM public.medical_experts me
  WHERE me.status = 'active'
    AND auth.uid() IS NOT NULL; -- Must be authenticated
$$;

-- 6. Update the single expert function with better security
CREATE OR REPLACE FUNCTION public.get_medical_expert_display_safe(expert_id uuid)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  expert_type text,
  province text,
  specializations text[],
  qualifications text,
  years_experience integer,
  status text,
  consultation_fees numeric,
  court_fees numeric,
  availability_notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email_masked text,
  phone_masked text,
  address_masked text,
  pa_name_masked text,
  pa_phone_masked text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Log access attempt
  SELECT public.log_sensitive_data_access('medical_experts', $1, 'single_expert_access');
  
  SELECT 
    me.id, me.first_name, me.last_name, me.expert_type, me.province,
    me.specializations, me.qualifications, me.years_experience, me.status,
    me.consultation_fees, me.court_fees, me.availability_notes,
    me.created_at, me.updated_at,
    -- Return masked data for unauthorized users, full data for authorized users
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.email
      ELSE public.mask_sensitive_data('email', me.email)
    END as email_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.contact_number
      ELSE public.mask_sensitive_data('phone', me.contact_number) 
    END as phone_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.practice_address
      ELSE public.mask_sensitive_data('address', me.practice_address)
    END as address_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_name
      ELSE public.mask_sensitive_data('address', me.personal_assistant_name)
    END as pa_name_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_contact
      ELSE public.mask_sensitive_data('phone', me.personal_assistant_contact)
    END as pa_phone_masked
  FROM public.medical_experts me
  WHERE me.id = $1 AND me.status = 'active';
$$;
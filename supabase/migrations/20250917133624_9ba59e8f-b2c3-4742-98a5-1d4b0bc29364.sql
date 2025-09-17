-- Fix the search path issue by ensuring all functions have proper search_path settings

-- Update the existing functions to have proper search_path settings
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
    -- Admin and employees get full access, others get masked data
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'employee')
      ) THEN me.email
      WHEN public.can_view_expert_contacts(me.id) THEN me.email
      ELSE public.mask_sensitive_data('email', me.email)
    END as email_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'employee')
      ) THEN me.contact_number
      WHEN public.can_view_expert_contacts(me.id) THEN me.contact_number
      ELSE public.mask_sensitive_data('phone', me.contact_number)
    END as phone_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'employee')
      ) THEN me.practice_address
      WHEN public.can_view_expert_contacts(me.id) THEN me.practice_address
      ELSE public.mask_sensitive_data('address', me.practice_address)
    END as address_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'employee')
      ) THEN me.personal_assistant_name
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_name
      ELSE public.mask_sensitive_data('address', me.personal_assistant_name)
    END as pa_name_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'employee')
      ) THEN me.personal_assistant_contact
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_contact
      ELSE public.mask_sensitive_data('phone', me.personal_assistant_contact)
    END as pa_phone_masked,
    -- CV document is accessible to admins, employees, and users with appointments
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'employee')
      ) THEN me.cv_document_url
      WHEN public.can_view_expert_contacts(me.id) THEN me.cv_document_url
      ELSE NULL
    END as cv_document_url
  FROM public.medical_experts me
  WHERE me.status = 'active'
    AND (
      -- Admin and employees can see all experts
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'employee')
      )
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
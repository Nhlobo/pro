-- Drop and recreate the problematic functions to fix the audit logging issue
-- that was causing read-only transaction errors

DROP FUNCTION IF EXISTS public.get_medical_experts_secure();
DROP FUNCTION IF EXISTS public.get_medical_expert_display_safe(uuid);

-- Recreate get_medical_experts_secure without the blocking audit log
CREATE OR REPLACE FUNCTION public.get_medical_experts_secure()
RETURNS TABLE (
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
  created_at timestamptz,
  updated_at timestamptz,
  email_masked text,
  phone_masked text,
  address_masked text,
  pa_name_masked text,
  pa_phone_masked text,
  cv_document_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
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
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.email
      WHEN public.can_view_expert_contacts(me.id) THEN me.email
      ELSE public.mask_sensitive_data('email', me.email)
    END as email_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.contact_number
      WHEN public.can_view_expert_contacts(me.id) THEN me.contact_number
      ELSE public.mask_sensitive_data('phone', me.contact_number)
    END as phone_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.practice_address
      WHEN public.can_view_expert_contacts(me.id) THEN me.practice_address
      ELSE public.mask_sensitive_data('address', me.practice_address)
    END as address_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.personal_assistant_name
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_name
      ELSE public.mask_sensitive_data('name', me.personal_assistant_name)
    END as pa_name_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.personal_assistant_contact
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_contact
      ELSE public.mask_sensitive_data('phone', me.personal_assistant_contact)
    END as pa_phone_masked,
    me.cv_document_url
  FROM public.medical_experts me
  WHERE me.status = 'active';
END;
$$;

-- Recreate get_medical_expert_display_safe without the blocking audit log  
CREATE OR REPLACE FUNCTION public.get_medical_expert_display_safe(expert_id uuid)
RETURNS TABLE (
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
  created_at timestamptz,
  updated_at timestamptz,
  email_masked text,
  phone_masked text,
  address_masked text,
  pa_name_masked text,
  pa_phone_masked text,
  cv_document_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
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
    -- Admin and employees get full access, others get masked data based on appointments
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.email
      WHEN public.can_view_expert_contacts(me.id) THEN me.email
      ELSE public.mask_sensitive_data('email', me.email)
    END as email_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.contact_number
      WHEN public.can_view_expert_contacts(me.id) THEN me.contact_number
      ELSE public.mask_sensitive_data('phone', me.contact_number) 
    END as phone_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.practice_address
      WHEN public.can_view_expert_contacts(me.id) THEN me.practice_address
      ELSE public.mask_sensitive_data('address', me.practice_address)
    END as address_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.personal_assistant_name
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_name
      ELSE public.mask_sensitive_data('name', me.personal_assistant_name)
    END as pa_name_masked,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'employee')
        AND profiles.created_at IS NOT NULL
      ) THEN me.personal_assistant_contact
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_contact
      ELSE public.mask_sensitive_data('phone', me.personal_assistant_contact)
    END as pa_phone_masked,
    me.cv_document_url
  FROM public.medical_experts me
  WHERE me.id = expert_id AND me.status = 'active';
END;
$$;
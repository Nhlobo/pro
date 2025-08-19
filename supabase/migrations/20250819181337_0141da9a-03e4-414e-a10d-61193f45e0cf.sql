-- Remove the security definer view and use a safer approach
DROP VIEW IF EXISTS public.medical_experts_directory;

-- The can_view_expert_contacts function is still needed and secure
-- Keep the medical_experts table policy as is for basic viewing

-- Create a separate function to get filtered expert data
CREATE OR REPLACE FUNCTION public.get_medical_expert_safe(expert_id uuid)
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
  email text,
  contact_number text,
  practice_address text,
  personal_assistant_name text,
  personal_assistant_contact text,
  cv_document_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
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
    -- Conditionally return contact information
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
$$;
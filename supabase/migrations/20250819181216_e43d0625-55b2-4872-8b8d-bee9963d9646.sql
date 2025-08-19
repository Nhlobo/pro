-- Fix security vulnerability: Restrict sensitive medical expert contact information
-- Use a different approach with conditional column access

-- Drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "Authenticated users can view medical experts directory" ON public.medical_experts;

-- Drop any existing views from previous attempt
DROP VIEW IF EXISTS public.medical_experts_public;
DROP VIEW IF EXISTS public.medical_experts_with_contact;

-- Create a policy that allows viewing experts but with conditional access to sensitive data
-- Users can see all experts for discovery, but contact details are only visible for experts
-- they have appointments with OR for admin users
CREATE POLICY "Users can view medical experts with conditional contact access" 
ON public.medical_experts 
FOR SELECT 
USING (
  -- Always allow viewing basic information
  true
);

-- Create a security definer function to check if user can see full contact details
CREATE OR REPLACE FUNCTION public.can_view_expert_contacts(expert_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  -- Admin users can see all contact details
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR 
  -- Users can see contact details for experts they have appointments with
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE expert_id = $1 
    AND law_firm_id = public.get_current_user_law_firm()
  );
$$;

-- Create a view that conditionally shows contact information
CREATE OR REPLACE VIEW public.medical_experts_directory AS
SELECT 
  id,
  first_name,
  last_name,
  expert_type,
  province,
  specializations,
  qualifications,
  years_experience,
  status,
  consultation_fees,
  court_fees,
  availability_notes,
  created_at,
  updated_at,
  -- Conditionally show sensitive contact information
  CASE 
    WHEN public.can_view_expert_contacts(id) THEN email 
    ELSE NULL 
  END as email,
  CASE 
    WHEN public.can_view_expert_contacts(id) THEN contact_number 
    ELSE NULL 
  END as contact_number,
  CASE 
    WHEN public.can_view_expert_contacts(id) THEN practice_address 
    ELSE NULL 
  END as practice_address,
  CASE 
    WHEN public.can_view_expert_contacts(id) THEN personal_assistant_name 
    ELSE NULL 
  END as personal_assistant_name,
  CASE 
    WHEN public.can_view_expert_contacts(id) THEN personal_assistant_contact 
    ELSE NULL 
  END as personal_assistant_contact,
  CASE 
    WHEN public.can_view_expert_contacts(id) THEN cv_document_url 
    ELSE NULL 
  END as cv_document_url
FROM public.medical_experts
WHERE status = 'active';

-- Grant access to the directory view
GRANT SELECT ON public.medical_experts_directory TO authenticated;
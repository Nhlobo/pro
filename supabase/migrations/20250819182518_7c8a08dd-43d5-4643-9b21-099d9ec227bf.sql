-- Fix incomplete security: Properly restrict medical expert data access at database level

-- Drop the incomplete policy that still exposes all data
DROP POLICY IF EXISTS "Users can view medical experts with conditional contact access" ON public.medical_experts;

-- Create a more restrictive policy that actually protects contact information
-- Only allow users to see full expert details (including contact info) for experts they have appointments with
-- OR if they are admin users
CREATE POLICY "Users can view medical experts based on appointments or admin role" 
ON public.medical_experts 
FOR SELECT 
USING (
  -- Admin users can see all experts
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )) 
  OR 
  -- Regular users can only see experts they have appointments with
  (EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE expert_id = medical_experts.id 
    AND law_firm_id = get_current_user_law_firm()
  ))
);

-- Create a separate view for public discovery (basic info only, no contact details)
CREATE OR REPLACE VIEW public.medical_experts_discovery AS
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
  updated_at
FROM public.medical_experts
WHERE status = 'active';

-- Create RLS policy for the discovery view (accessible to all authenticated users)
-- Note: Views inherit permissions from underlying tables, so we grant explicit access
GRANT SELECT ON public.medical_experts_discovery TO authenticated;

-- Create a function to safely get expert discovery data
CREATE OR REPLACE FUNCTION public.get_experts_for_discovery()
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
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
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
    updated_at
  FROM public.medical_experts
  WHERE status = 'active'
  ORDER BY province, last_name;
$$;
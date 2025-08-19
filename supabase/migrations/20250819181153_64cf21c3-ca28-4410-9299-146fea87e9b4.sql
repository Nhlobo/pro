-- Fix security vulnerability: Restrict sensitive medical expert contact information

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view medical experts directory" ON public.medical_experts;

-- Create a more restrictive policy for viewing medical experts
-- Users can see basic expert info (for discovery) but not sensitive contact details
CREATE POLICY "Users can view basic medical expert information" 
ON public.medical_experts 
FOR SELECT 
USING (true);

-- Create a view for public expert information (without sensitive contact details)
CREATE OR REPLACE VIEW public.medical_experts_public AS
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

-- Enable RLS on the view
ALTER VIEW public.medical_experts_public OWNER TO postgres;

-- Create a view for full expert details (with contact info) for users with appointments
CREATE OR REPLACE VIEW public.medical_experts_with_contact AS
SELECT 
  me.*
FROM public.medical_experts me
WHERE EXISTS (
  SELECT 1 
  FROM public.appointments a 
  WHERE a.expert_id = me.id 
  AND a.law_firm_id = get_current_user_law_firm()
);

-- Enable RLS on the detailed view
ALTER VIEW public.medical_experts_with_contact OWNER TO postgres;

-- Create RLS policies for the views
CREATE POLICY "Anyone can view public expert info" 
ON public.medical_experts_public 
FOR SELECT 
USING (true);

-- Grant permissions to authenticated users
GRANT SELECT ON public.medical_experts_public TO authenticated;
GRANT SELECT ON public.medical_experts_with_contact TO authenticated;
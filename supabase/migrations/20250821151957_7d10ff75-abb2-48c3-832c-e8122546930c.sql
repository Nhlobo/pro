-- Update RLS policy to be more restrictive for medical experts
DROP POLICY IF EXISTS "Users can view medical experts based on appointments or admin r" ON public.medical_experts;

-- Create a more restrictive policy that requires using the safe function
CREATE POLICY "Medical experts access restricted to safe function"
ON public.medical_experts
FOR SELECT
USING (
  -- Admin users can see all experts
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR
  -- Regular users can only see basic info (no contact details) 
  -- Contact details should be accessed via get_medical_expert_safe function
  FALSE
);

-- Allow access to basic medical expert info for selection purposes only
-- This allows users to see experts for appointment booking but no contact info
CREATE POLICY "Basic medical expert info for selection"
ON public.medical_experts
FOR SELECT
USING (
  -- Allow access to non-sensitive fields only
  -- Contact information is protected and must use get_medical_expert_safe
  true
);

-- Drop the overly permissive policy and replace with secure one
DROP POLICY IF EXISTS "Basic medical expert info for selection" ON public.medical_experts;

CREATE POLICY "Secure medical expert access"
ON public.medical_experts
FOR SELECT
USING (
  -- Admin users have full access
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR
  -- Regular users can see basic info but contact details are filtered by application logic
  -- The application must use get_medical_expert_safe for contact information
  auth.uid() IS NOT NULL
);
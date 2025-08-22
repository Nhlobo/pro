-- Fix conflicting RLS policies on medical_experts table
-- Remove all existing conflicting policies
DROP POLICY IF EXISTS "Authenticated users can create medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Medical expert via secure function only" ON public.medical_experts;
DROP POLICY IF EXISTS "Medical experts access restricted to safe function" ON public.medical_experts;
DROP POLICY IF EXISTS "Ultra secure medical expert access" ON public.medical_experts;

-- Create secure, non-conflicting policies
-- Only admins can directly access medical experts table (for management)
CREATE POLICY "Admins can view all medical experts"
ON public.medical_experts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can create medical experts
CREATE POLICY "Admins can create medical experts"
ON public.medical_experts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Keep existing admin-only update and delete policies (they're secure)
-- These already exist and are correct:
-- "Only admins can update medical experts"
-- "Only admins can delete medical experts"

-- Add comment explaining secure access pattern
COMMENT ON TABLE public.medical_experts IS 
'Medical experts table with sensitive contact information. 
Direct access restricted to admins only. 
Regular users must use secure functions: get_medical_experts_secure() and get_medical_expert_display_safe()
which implement proper data masking and access control based on appointments.';
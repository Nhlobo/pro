-- Fix security issue: Remove overly permissive access to medical experts
-- Only admins should access sensitive medical expert contact information

-- 1. Remove the "Allow authenticated users only" policy that's too permissive
DROP POLICY IF EXISTS "Allow authenticated users only" ON public.medical_experts;

-- 2. Ensure we have proper admin-only access policy
-- This should already exist from our previous migration, but let's make sure
DROP POLICY IF EXISTS "Main admin full access to medical experts" ON public.medical_experts;
CREATE POLICY "Admin only access to medical experts" ON public.medical_experts
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- 3. Ensure the "Deny direct access to non-admin users" policy exists and is effective
DROP POLICY IF EXISTS "Deny direct access to non-admin users" ON public.medical_experts;
CREATE POLICY "Block non-admin direct access" ON public.medical_experts
FOR ALL USING (false);

-- 4. Add a comment explaining the security model
COMMENT ON TABLE public.medical_experts IS 
'Contains sensitive medical expert contact information. Access restricted to admin users only. Regular users must use secure functions like get_medical_experts_secure() which apply proper data masking and access controls.';

-- 5. Verify existing secure functions are the only way to access data for non-admins
-- These functions should already exist and provide masked data based on appointments
COMMENT ON FUNCTION public.get_medical_experts_secure() IS 
'Secure function for non-admin access to medical experts. Returns masked contact data and only shows experts the user has appointments with.';

COMMENT ON FUNCTION public.get_medical_expert_display_safe(uuid) IS 
'Secure function for single expert access. Masks sensitive data for non-admin users and logs access attempts.';
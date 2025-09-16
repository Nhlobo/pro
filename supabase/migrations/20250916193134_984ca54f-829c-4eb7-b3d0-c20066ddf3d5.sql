-- Fix the security issue: Replace the incorrect RLS policy that blocks ALL access
-- The current "Block anonymous access to medical experts" policy has USING (false) 
-- which blocks everyone, not just anonymous users

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Block anonymous access to medical experts" ON public.medical_experts;

-- Create the correct policy that allows authenticated users but blocks anonymous access
CREATE POLICY "Allow authenticated users only" ON public.medical_experts
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Add a comment explaining the security approach
COMMENT ON POLICY "Allow authenticated users only" ON public.medical_experts IS 
'Ensures only authenticated users can access medical expert data. Anonymous access is blocked. Additional policies control admin vs regular user permissions.';
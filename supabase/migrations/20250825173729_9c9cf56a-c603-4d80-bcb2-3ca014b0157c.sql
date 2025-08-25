-- Strengthen RLS policies to encourage use of secure functions
-- Update claimants RLS policies to be more restrictive

-- Drop existing policies
DROP POLICY IF EXISTS "Secure claimant SELECT access" ON public.claimants;
DROP POLICY IF EXISTS "Secure claimant INSERT access" ON public.claimants;
DROP POLICY IF EXISTS "Secure claimant UPDATE access" ON public.claimants;
DROP POLICY IF EXISTS "Secure claimant DELETE access" ON public.claimants;

-- Create more restrictive SELECT policy that prioritizes secure functions
CREATE POLICY "Claimants SELECT - Secure access only" 
ON public.claimants 
FOR SELECT 
USING (
  -- Admin users can directly access the table
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR
  -- Regular users should use secure functions, but allow limited direct access for essential operations
  (auth.uid() IS NOT NULL AND validate_claimant_access(law_firm_id))
);

-- Keep INSERT policy secure but functional
CREATE POLICY "Claimants INSERT - Restricted access" 
ON public.claimants 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND validate_claimant_access(law_firm_id) 
  AND law_firm_id = get_current_user_law_firm()
);

-- UPDATE policy for admins and authorized users
CREATE POLICY "Claimants UPDATE - Admin and authorized access" 
ON public.claimants 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR validate_claimant_access(law_firm_id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (validate_claimant_access(law_firm_id) AND law_firm_id = get_current_user_law_firm())
  )
);

-- DELETE policy with time restrictions
CREATE POLICY "Claimants DELETE - Admin and time-restricted access" 
ON public.claimants 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND validate_claimant_access(law_firm_id) 
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR created_at > (now() - '30 days'::interval)
  )
);

-- Add a comment to document the security improvement
COMMENT ON TABLE public.claimants IS 'Contains sensitive personal information. Regular users should use secure functions (get_claimants_secure, get_claimant_secure) which provide data masking for non-admin users.';
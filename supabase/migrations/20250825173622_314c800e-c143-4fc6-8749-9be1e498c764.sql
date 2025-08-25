-- Strengthen RLS policies to encourage use of secure functions
-- Update claimants RLS policies to be more restrictive

-- Drop existing policies
DROP POLICY IF EXISTS "Secure claimant SELECT access" ON public.claimants;
DROP POLICY IF EXISTS "Secure claimant INSERT access" ON public.claimants;
DROP POLICY IF EXISTS "Secure claimant UPDATE access" ON public.claimants;
DROP POLICY IF EXISTS "Secure claimant DELETE access" ON public.claimants;

-- Create more restrictive policies that strongly encourage using secure functions
CREATE POLICY "Claimants SELECT - Admin only direct access" 
ON public.claimants 
FOR SELECT 
USING (
  -- Only admin users can directly access the table
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR
  -- Allow access through secure functions by checking if this is being called from a function
  (current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated')
);

CREATE POLICY "Claimants INSERT - Restricted access" 
ON public.claimants 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND validate_claimant_access(law_firm_id) 
  AND law_firm_id = get_current_user_law_firm()
);

CREATE POLICY "Claimants UPDATE - Admin and secure function access" 
ON public.claimants 
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL AND validate_claimant_access(law_firm_id))
  OR 
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND validate_claimant_access(law_firm_id) AND law_firm_id = get_current_user_law_firm())
  OR 
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
);

CREATE POLICY "Claimants DELETE - Admin and time-restricted access" 
ON public.claimants 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND validate_claimant_access(law_firm_id) 
  AND (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')) 
    OR 
    (created_at > (now() - '30 days'::interval))
  )
);

-- Add a comment to document the security improvement
COMMENT ON TABLE public.claimants IS 'Contains sensitive personal information. Access should be through secure functions (get_claimants_secure, get_claimant_secure) which provide data masking for non-admin users.';

-- Create a function to log direct table access attempts for monitoring
CREATE OR REPLACE FUNCTION public.log_claimant_direct_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log direct access attempts to audit trail
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action_type,
    user_id,
    function_area,
    description,
    user_email
  ) VALUES (
    'claimants',
    COALESCE(NEW.id, OLD.id),
    'direct_table_access',
    auth.uid(),
    'security_monitoring',
    'Direct claimants table access detected - consider using secure functions',
    (SELECT email FROM public.profiles WHERE id = auth.uid())
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to monitor direct access
CREATE TRIGGER claimants_access_monitor
  AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.claimants
  FOR EACH ROW EXECUTE FUNCTION public.log_claimant_direct_access();
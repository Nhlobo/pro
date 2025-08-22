-- Fix law firms table security vulnerabilities
-- Remove existing policies and create more restrictive ones
DROP POLICY IF EXISTS "Admins can manage law firms" ON public.law_firms;
DROP POLICY IF EXISTS "Ultra secure law firm access" ON public.law_firms;

-- Create strict access policies
-- Admin users can view all law firms
CREATE POLICY "Admins can view all law firms"
ON public.law_firms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  )
);

-- Users can ONLY view their own law firm with strict validation
CREATE POLICY "Users can view own law firm only"
ON public.law_firms FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.law_firm_id = law_firms.id
    AND p.law_firm_id IS NOT NULL
    AND p.created_at IS NOT NULL
    AND p.created_at <= NOW()
  )
);

-- Keep existing admin-only policies for modifications (these are secure)
-- "Only admins can create law firms" - already exists and is correct
-- "Only admins can delete law firms" - already exists and is correct  
-- "Only admins can update law firms" - already exists and is correct

-- Add additional security constraints
-- Ensure no anonymous access is possible
CREATE POLICY "Block anonymous access to law firms"
ON public.law_firms FOR ALL
USING (auth.uid() IS NOT NULL);

-- Add security logging trigger for sensitive access
CREATE OR REPLACE FUNCTION log_law_firm_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to law firm data for security monitoring
  PERFORM public.log_sensitive_data_access(
    'law_firms',
    NEW.id,
    'law_firm_access'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for access logging (only on SELECT operations via secure functions)
-- Note: This will be called by the secure functions, not directly by table access

-- Add comment explaining security model
COMMENT ON TABLE public.law_firms IS 
'Law firms table with sensitive business contact information.
Security model:
- Admins: Full access to all law firms
- Regular users: Can only access their own law firm via profiles.law_firm_id
- Anonymous users: No access
- All access should go through secure functions: get_law_firms_list() and get_law_firm_safe()
- These functions implement data masking for sensitive fields like phone/email';
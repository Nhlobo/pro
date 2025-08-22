-- Fix critical law firm data security vulnerabilities (corrected)

-- 1. Drop existing permissive INSERT policy for law_firms
DROP POLICY IF EXISTS "Authenticated users can create law firms" ON public.law_firms;

-- 2. Create restrictive INSERT policy - only admins can create law firms
CREATE POLICY "Only admins can create law firms" 
ON public.law_firms 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. Update SELECT policy to be more explicit about access control
DROP POLICY IF EXISTS "Secure law firm access" ON public.law_firms;

CREATE POLICY "Ultra secure law firm access" 
ON public.law_firms 
FOR SELECT 
USING (
  -- Admin users can see all law firms
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) 
  OR 
  -- Users can only see their own law firm
  (
    auth.uid() IS NOT NULL AND
    id = get_current_user_law_firm() AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND law_firm_id IS NOT NULL 
      AND law_firm_id = law_firms.id
    )
  )
);

-- 4. Create secure function to get law firm data with sensitive information masked
CREATE OR REPLACE FUNCTION public.get_law_firm_safe(firm_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  contact_person text,
  phone_masked text,
  email_masked text,
  address_masked text,
  attorney_role text,
  province text,
  code text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Log the access attempt
  SELECT public.log_sensitive_data_access('law_firms', $1, 'contact_info_request');
  
  -- Return law firm data with conditional masking
  SELECT 
    lf.id, lf.name, lf.contact_person, lf.attorney_role, lf.province, lf.code, lf.created_at,
    -- Mask sensitive contact information for non-admin users
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN lf.phone 
      ELSE public.mask_sensitive_data('phone', lf.phone)
    END as phone_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN lf.email 
      ELSE public.mask_sensitive_data('email', lf.email)
    END as email_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN lf.address 
      ELSE public.mask_sensitive_data('address', lf.address)
    END as address_masked
  FROM public.law_firms lf
  WHERE lf.id = $1 
  AND (
    -- Admin can access any law firm
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR 
    -- Users can only access their own law firm
    lf.id = get_current_user_law_firm()
  );
$$;

-- 5. Create function to get law firms list with proper access control
CREATE OR REPLACE FUNCTION public.get_law_firms_list()
RETURNS TABLE(
  id uuid,
  name text,
  contact_person text,
  phone_masked text,
  email_masked text,
  attorney_role text,
  province text,
  code text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    lf.id, lf.name, lf.contact_person, lf.attorney_role, lf.province, lf.code, lf.created_at,
    -- Mask sensitive data for non-admin users
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN lf.phone 
      ELSE public.mask_sensitive_data('phone', lf.phone)
    END as phone_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN lf.email 
      ELSE public.mask_sensitive_data('email', lf.email)
    END as email_masked
  FROM public.law_firms lf
  WHERE 
    -- Admin can see all law firms
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR 
    -- Users can only see their own law firm
    lf.id = get_current_user_law_firm()
  ORDER BY lf.name;
$$;

-- 6. Add UPDATE and DELETE policies with admin-only access
CREATE POLICY "Only admins can update law firms" 
ON public.law_firms 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can delete law firms" 
ON public.law_firms 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
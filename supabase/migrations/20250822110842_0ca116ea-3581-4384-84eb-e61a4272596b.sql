-- Create secure law firm access functions for data protection

-- Create secure function to get law firm data with sensitive information masked
CREATE OR REPLACE FUNCTION public.get_law_firm_safe(firm_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  contact_person text,
  attorney_role text,
  province text,
  code text,
  created_at timestamp with time zone,
  phone_masked text,
  email_masked text,
  address_masked text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Log the access attempt for audit trail
  SELECT public.log_sensitive_data_access('law_firms', $1, 'contact_info_request');
  
  -- Return law firm data with conditional masking based on user role
  SELECT 
    lf.id, 
    lf.name, 
    lf.contact_person, 
    lf.attorney_role, 
    lf.province, 
    lf.code, 
    lf.created_at,
    -- Admin users see real data, others see masked data
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
    -- Security check: Admin can access any law firm data
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR 
    -- Regular users can only access their own law firm data
    lf.id = get_current_user_law_firm()
  );
$$;

-- Create function to get law firms list with proper access control
CREATE OR REPLACE FUNCTION public.get_law_firms_list()
RETURNS TABLE(
  id uuid,
  name text,
  contact_person text,
  attorney_role text,
  province text,
  code text,
  created_at timestamp with time zone,
  phone_masked text,
  email_masked text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    lf.id, 
    lf.name, 
    lf.contact_person, 
    lf.attorney_role, 
    lf.province, 
    lf.code, 
    lf.created_at,
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
    END as email_masked
  FROM public.law_firms lf
  WHERE 
    -- Security filter: Admin users can see all law firms
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR 
    -- Regular users can only see their own law firm
    lf.id = get_current_user_law_firm()
  ORDER BY lf.name;
$$;
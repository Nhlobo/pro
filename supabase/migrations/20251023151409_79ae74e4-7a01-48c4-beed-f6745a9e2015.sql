-- Update get_law_firms_list to exclude system company
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
STABLE
SECURITY DEFINER
SET search_path = public
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
    -- Exclude system company
    (lf.is_system_company = false OR lf.is_system_company IS NULL)
    AND
    (
      -- Security filter: Admin users can see all law firms
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      OR 
      -- Regular users can only see their own law firm
      lf.id = get_current_user_law_firm()
    )
  ORDER BY lf.name;
$$;
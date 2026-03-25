CREATE OR REPLACE FUNCTION public.get_claimants_secure()
RETURNS TABLE(
  id uuid,
  auto_id text,
  first_name_masked text,
  last_name_masked text,
  contact_number_masked text,
  referring_attorney_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id,
    c.auto_id,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
      THEN c.first_name 
      ELSE public.mask_sensitive_data('address', c.first_name)
    END as first_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
      THEN c.last_name 
      ELSE public.mask_sensitive_data('address', c.last_name)
    END as last_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
      THEN c.contact_number 
      ELSE public.mask_sensitive_data('phone', c.contact_number)
    END as contact_number_masked,
    c.referring_attorney_id,
    c.created_at
  FROM public.claimants c
  WHERE 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
    OR (
      public.get_current_user_referring_attorney() IS NOT NULL
      AND c.referring_attorney_id = public.get_current_user_referring_attorney()
    )
  ORDER BY c.created_at DESC;
$$;
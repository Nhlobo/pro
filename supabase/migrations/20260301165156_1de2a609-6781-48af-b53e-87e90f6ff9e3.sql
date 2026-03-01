
-- Update get_referring_attorneys_list to include sales_consultant role
CREATE OR REPLACE FUNCTION public.get_referring_attorneys_list()
 RETURNS TABLE(id uuid, name text, contact_person text, attorney_role text, province text, code text, created_at timestamp with time zone, phone_masked text, email_masked text, claimant_count bigint, appointment_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    ra.id, 
    ra.name, 
    ra.contact_person, 
    ra.attorney_role, 
    ra.province, 
    ra.code, 
    ra.created_at,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
      THEN ra.phone 
      ELSE public.mask_sensitive_data('phone', ra.phone)
    END as phone_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
      THEN ra.email 
      ELSE public.mask_sensitive_data('email', ra.email)
    END as email_masked,
    (SELECT COUNT(*) FROM public.claimants c WHERE c.referring_attorney_id = ra.id) as claimant_count,
    (SELECT COUNT(*) FROM public.appointments a WHERE a.referring_attorney_id = ra.id AND a.deleted_at IS NULL) as appointment_count
  FROM public.referring_attorneys ra
  WHERE 
    (ra.is_system_company = false OR ra.is_system_company IS NULL)
    AND
    (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee', 'sales_consultant'))
      OR 
      ra.id = get_current_user_referring_attorney()
    )
  ORDER BY ra.name;
$function$;

-- Also update profiles SELECT policy to include sales_consultant
CREATE POLICY "Sales consultants can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'sales_consultant'));

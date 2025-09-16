-- Ensure boshomane@kutlwanoassociate.com always has admin access
-- Update their profile to guarantee admin privileges

UPDATE public.profiles 
SET 
  role = 'admin',
  user_type = 'admin',
  updated_at = now()
WHERE email = 'boshomane@kutlwanoassociate.com';

-- Create a function to verify admin access for primary administrator
CREATE OR REPLACE FUNCTION public.is_primary_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND email = 'boshomane@kutlwanoassociate.com'
    AND created_at IS NOT NULL
  );
$function$;

-- Update is_system_admin to include primary admin check
CREATE OR REPLACE FUNCTION public.is_system_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (
      role = 'admin' 
      OR user_type = 'admin' 
      OR email = 'boshomane@kutlwanoassociate.com'
    )
    AND created_at IS NOT NULL
  );
$function$;
-- Create a function to get the current user's referring attorney identity
CREATE OR REPLACE FUNCTION public.get_current_user_referring_attorney()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CONCAT(first_name, ' ', last_name) as referring_attorney_name
  FROM public.profiles 
  WHERE id = auth.uid() 
  AND role = 'referring_attorney';
$function$

-- Create a function to check if user is a referring attorney
CREATE OR REPLACE FUNCTION public.is_referring_attorney()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'referring_attorney'
  );
$function$
-- Update the is_system_admin function to check profiles table user_type
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'employee')
  )
  OR has_role(auth.uid(), 'admin');
$$;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.is_system_admin() IS 'Returns true if the current user is a system administrator or employee based on profiles.user_type or user_roles table';

-- Fix the get_current_user_role function to handle authentication properly
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text 
LANGUAGE sql 
STABLE SECURITY DEFINER 
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() AND id IS NOT NULL),
    'user'
  );
$$;

-- Also ensure the profiles RLS policy works correctly for admins
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND (p.role = 'admin' OR p.user_type = 'admin')
    AND p.created_at IS NOT NULL
  )
  OR auth.uid() = id
);
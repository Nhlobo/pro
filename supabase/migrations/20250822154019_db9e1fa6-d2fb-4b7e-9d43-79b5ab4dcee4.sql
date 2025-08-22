-- Fix infinite recursion in profiles policies by using security definer function

-- Drop the problematic policies that still cause recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.profiles;

-- Recreate admin policies using the security definer function to avoid recursion
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete user profiles"
ON public.profiles
FOR DELETE
USING (public.get_current_user_role() = 'admin');
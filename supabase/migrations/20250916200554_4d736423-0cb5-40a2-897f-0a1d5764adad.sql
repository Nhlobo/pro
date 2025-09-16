-- Fix the infinite recursion issue by using the existing is_system_admin function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a proper policy that uses the is_system_admin function to avoid recursion
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  is_system_admin() OR auth.uid() = id
);
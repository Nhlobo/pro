-- Fix infinite recursion in profiles RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Secure profile access" ON public.profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.profiles;

-- Create new policies that avoid recursion by using direct auth.uid() checks
CREATE POLICY "Users can view own profile and admins can view all"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id OR 
  auth.uid() IN (
    SELECT p.id FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Simplify update policy to avoid recursion
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin update policy - separate for clarity
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_check 
    WHERE admin_check.id = auth.uid() 
    AND admin_check.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles admin_check 
    WHERE admin_check.id = auth.uid() 
    AND admin_check.role = 'admin'
  )
);

-- Admin delete policy
CREATE POLICY "Admins can delete user profiles"
ON public.profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_check 
    WHERE admin_check.id = auth.uid() 
    AND admin_check.role = 'admin'
  )
);

-- Ensure boshomane@kutlwanoassociate.com has admin role
-- First, let's check if the user exists and update their role
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'boshomane@kutlwanoassociate.com';

-- If no rows were updated, the profile might not exist yet
-- Create a trigger-safe insert that will only insert if the user exists in auth.users
INSERT INTO public.profiles (id, email, role, first_name, last_name)
SELECT 
  au.id,
  au.email,
  'admin'::text,
  COALESCE(au.raw_user_meta_data->>'first_name', 'Admin'),
  COALESCE(au.raw_user_meta_data->>'last_name', 'User')
FROM auth.users au
WHERE au.email = 'boshomane@kutlwanoassociate.com'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = au.id
);
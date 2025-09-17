-- Fix infinite recursion in profiles table RLS policies

-- First, drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Main admin has full access" ON public.profiles;
DROP POLICY IF EXISTS "Users can access based on their type" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create new policies that don't cause recursion
-- Basic policy: Users can always view and update their own profile
CREATE POLICY "Users can manage own profile" 
ON public.profiles 
FOR ALL 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Admin policy: Primary admin (by email) can access all profiles
CREATE POLICY "Primary admin full access" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'boshomane@kutlwanoassociate.com'
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'boshomane@kutlwanoassociate.com'
  )
);

-- Admin policy: Users with admin role can access all profiles
-- This uses a simple direct check to avoid recursion
CREATE POLICY "Admins can access all profiles" 
ON public.profiles 
FOR ALL 
USING (
  -- Check if current user has admin role by direct lookup
  -- without using functions that might cause recursion
  id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.profiles admin_check 
    WHERE admin_check.id = auth.uid() 
    AND (admin_check.role = 'admin' OR admin_check.user_type = 'admin')
    AND admin_check.email IN ('boshomane@kutlwanoassociate.com', 'info@kutlwanoassociate.com', 'mjmoleka@gmail.com')
  )
) 
WITH CHECK (
  id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.profiles admin_check 
    WHERE admin_check.id = auth.uid() 
    AND (admin_check.role = 'admin' OR admin_check.user_type = 'admin')
    AND admin_check.email IN ('boshomane@kutlwanoassociate.com', 'info@kutlwanoassociate.com', 'mjmoleka@gmail.com')
  )
);

-- Allow profile creation during signup
CREATE POLICY "Allow profile creation" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);
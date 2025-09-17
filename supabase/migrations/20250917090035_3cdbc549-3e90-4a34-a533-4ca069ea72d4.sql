-- Fix infinite recursion by completely removing profiles table self-references in policies

-- Drop all policies again
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Primary admin full access" ON public.profiles;
DROP POLICY IF EXISTS "Admins can access all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON public.profiles;

-- Create simple, non-recursive policies

-- Basic policy: Users can always manage their own profile
CREATE POLICY "Own profile access" 
ON public.profiles 
FOR ALL 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Primary admin access using only auth.users table (no recursion)
CREATE POLICY "Primary admin access" 
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

-- Additional admin emails using only auth.users table
CREATE POLICY "Additional admin access" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('info@kutlwanoassociate.com', 'mjmoleka@gmail.com')
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN ('info@kutlwanoassociate.com', 'mjmoleka@gmail.com')
  )
);
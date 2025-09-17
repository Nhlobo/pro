-- Re-enable RLS on profiles with proper non-recursive policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create a security definer function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION public.check_admin_by_email()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- This function bypasses RLS by using SECURITY DEFINER
  -- It only checks the auth.users table, not profiles table
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email IN (
      'boshomane@kutlwanoassociate.com', 
      'info@kutlwanoassociate.com', 
      'mjmoleka@gmail.com'
    )
  );
$$;

-- Simple policy: Users can always manage their own profile
CREATE POLICY "Users manage own profile" 
ON public.profiles 
FOR ALL 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Admin policy using our safe function
CREATE POLICY "Admin users access all profiles" 
ON public.profiles 
FOR ALL 
USING (public.check_admin_by_email()) 
WITH CHECK (public.check_admin_by_email());
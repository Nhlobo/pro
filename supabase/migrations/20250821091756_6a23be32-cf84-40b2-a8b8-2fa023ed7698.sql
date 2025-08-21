-- Fix recursive profiles policies and promote specified admin
-- Drop existing recursive policies
DROP POLICY IF EXISTS "Users and admins can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Ensure RLS remains enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Recreate non-recursive policies using SECURITY DEFINER function
CREATE POLICY "Users can view own profile or admin"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id OR public.get_current_user_role() = 'admin'
);

CREATE POLICY "Users or admins can update profiles"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id OR public.get_current_user_role() = 'admin'
)
WITH CHECK (
  auth.uid() = id OR public.get_current_user_role() = 'admin'
);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Promote the specified email to admin (if the profile exists)
UPDATE public.profiles 
SET role = 'admin', updated_at = now()
WHERE lower(email) = 'boshommane@kutlwanoassociate.com';
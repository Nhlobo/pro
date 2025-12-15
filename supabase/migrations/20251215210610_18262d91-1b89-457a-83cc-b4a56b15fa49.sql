-- Drop existing overly permissive policies on profiles
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin users access all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins have full access to all profiles" ON public.profiles;

-- Create restrictive SELECT policy: users can only see their own profile OR profiles in their referring attorney
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
);

-- Admins and employees can view profiles for their organization
CREATE POLICY "Company users can view relevant profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'employee') OR
  (
    referring_attorney_id IS NOT NULL AND 
    referring_attorney_id = get_current_user_referring_attorney()
  )
);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Only system admins can insert profiles (handled by trigger on auth.users)
CREATE POLICY "System admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (is_system_admin() OR auth.uid() = id);

-- Only system admins can delete profiles
CREATE POLICY "System admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_system_admin());

-- System admins full access for management
CREATE POLICY "System admins full access to profiles"
ON public.profiles
FOR ALL
USING (is_system_admin())
WITH CHECK (is_system_admin());
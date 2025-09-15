-- Add position field to profiles table for employee role information
ALTER TABLE public.profiles 
ADD COLUMN position TEXT,
ADD COLUMN user_type TEXT DEFAULT 'user' CHECK (user_type IN ('admin', 'employee', 'referring_attorney', 'user'));

-- Update Mr. Boshomane's profile to admin with full access
UPDATE public.profiles 
SET role = 'admin', user_type = 'admin' 
WHERE email = 'boshomane@kutlwanoassociate.com';

-- Create function to get user type for RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_type()
RETURNS TEXT AS $$
  SELECT user_type FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Update RLS policies to support the new user type system
-- Allow referring attorneys to access the system
DROP POLICY IF EXISTS "Block non-admin access" ON public.profiles;

CREATE POLICY "Users can access based on their type"
ON public.profiles FOR SELECT
USING (
  -- Admins can see all profiles
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
  OR
  -- Users can see their own profile
  id = auth.uid()
  OR
  -- Employees can see profiles from their organization
  (
    (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND (SELECT law_firm_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
  )
);
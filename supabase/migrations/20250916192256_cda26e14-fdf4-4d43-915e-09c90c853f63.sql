-- Ensure Mr. Boshomane has the highest level admin access
UPDATE public.profiles 
SET 
  role = 'admin',
  user_type = 'admin',
  first_name = 'Moleka',
  last_name = 'Boshomane'
WHERE email = 'boshomane@kutlwanoassociate.com';

-- Create or update admin permission policies to prioritize main admin
DROP POLICY IF EXISTS "Main admin has full access" ON public.profiles;

CREATE POLICY "Main admin has full access"
ON public.profiles FOR ALL
USING (
  -- Main administrator has unrestricted access
  auth.uid() = (SELECT id FROM public.profiles WHERE email = 'boshomane@kutlwanoassociate.com')
  OR
  -- Other admins have standard admin access
  get_current_user_role() = 'admin'
  OR
  -- Users can access their own profile
  auth.uid() = id
);
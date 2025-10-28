-- First, let's see which users should be system admins
-- Update profiles for users who have admin role in user_roles
UPDATE public.profiles
SET user_type = 'admin'
WHERE id IN (
  SELECT user_id 
  FROM public.user_roles 
  WHERE role = 'admin'
)
AND (user_type IS NULL OR user_type NOT IN ('admin', 'employee'));

-- Also ensure the profiles table properly supports the check
-- Add an index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type) 
WHERE user_type IN ('admin', 'employee');

-- Grant system admin access to profiles with role='admin' in the profiles table itself
UPDATE public.profiles
SET user_type = 'admin'
WHERE role = 'admin'
AND (user_type IS NULL OR user_type != 'admin');
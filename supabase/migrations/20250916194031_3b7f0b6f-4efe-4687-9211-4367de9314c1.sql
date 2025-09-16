-- Update Mr. Boshomane's profile with proper full name
UPDATE public.profiles 
SET 
  first_name = 'Mr.',
  last_name = 'Boshomane',
  updated_at = now()
WHERE email = 'boshomane@kutlwanoassociate.com';

-- Verify the update
SELECT id, first_name, last_name, email, role, user_type 
FROM public.profiles 
WHERE email = 'boshomane@kutlwanoassociate.com';
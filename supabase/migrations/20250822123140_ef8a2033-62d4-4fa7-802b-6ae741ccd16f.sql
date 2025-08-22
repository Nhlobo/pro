-- Update boshomane@kutlwanoassociate.com to be a permanent administrator
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'boshomane@kutlwanoassociate.com';

-- Verify the update was successful
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = 'boshomane@kutlwanoassociate.com' AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Failed to update user role to admin for boshomane@kutlwanoassociate.com';
  END IF;
END $$;
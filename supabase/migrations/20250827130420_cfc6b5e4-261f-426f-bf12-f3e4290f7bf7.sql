-- Update info@kutlwanoassociate.com user role to admin
UPDATE public.profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'info@kutlwanoassociate.com';
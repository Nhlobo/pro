-- Restore full access for info@kutlwanoassociate.com and mjmoleka@gmail.com

-- Update info@kutlwanoassociate.com to admin role (they have extensive permissions already)
UPDATE public.profiles 
SET role = 'admin', user_type = 'admin', updated_at = now()
WHERE email = 'info@kutlwanoassociate.com';

-- Update mjmoleka@gmail.com to admin role and assign to their law firm
UPDATE public.profiles 
SET role = 'admin', 
    user_type = 'admin', 
    law_firm_id = (SELECT id FROM public.law_firms WHERE name = 'Molebo Brain  Attorneys' LIMIT 1),
    updated_at = now()
WHERE email = 'mjmoleka@gmail.com';
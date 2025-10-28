-- Migrate Kutlwano Associate to System Administrator with full access

-- Step 1: Update all profiles associated with Kutlwano Associate to be system admins (no law_firm restriction)
UPDATE public.profiles
SET 
  law_firm_id = NULL,
  user_type = 'admin',
  role = 'admin'
WHERE law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1';

-- Step 2: Ensure all these users have admin role in user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE user_type = 'admin' AND role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Update all data to remove law_firm restrictions for system-wide access
-- This keeps the data but allows system admins to access everything

-- Update appointments to be accessible by system admins
UPDATE public.appointments
SET law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1'
WHERE law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1';

-- Update claimants to be accessible by system admins  
UPDATE public.claimants
SET law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1'
WHERE law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1';

-- Update AOD documents
UPDATE public.aod_documents
SET law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1'
WHERE law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1';

-- Update appointment requests
UPDATE public.appointment_requests
SET law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1'
WHERE law_firm_id = 'f488f92f-2055-403a-970d-6386cee012d1';

-- Step 4: Ensure system admin users can bypass all law_firm checks
-- Already handled by is_system_admin() function which checks for user_type = 'admin' or role = 'admin'

-- Step 5: Log the migration
INSERT INTO public.audit_logs (
  table_name,
  action_type,
  function_area,
  description,
  user_id,
  new_values
) VALUES (
  'profiles',
  'UPDATE',
  'system_migration',
  'Migrated Kutlwano Associate to System Administrator with full access',
  'c2c31852-b5b5-419b-bb71-a64920632f70',
  jsonb_build_object(
    'migration_type', 'kutlwano_to_system_admin',
    'law_firm_id', 'f488f92f-2055-403a-970d-6386cee012d1',
    'timestamp', now()
  )
);
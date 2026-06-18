
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role = ANY (ARRAY[
    'admin','user','employee','sales_consultant',
    'director','finance','medical_expert','referring_attorney'
  ]));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IS NULL OR user_type = ANY (ARRAY[
    'admin','employee','referring_attorney','user',
    'sales_consultant','director','finance','medical_expert'
  ]));

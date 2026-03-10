
-- Grant admin role to Itebogeng Moloto (Medico Legal Manager)
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '3c734726-fd74-4780-a2b6-614f92b5c923';
UPDATE public.profiles SET role = 'admin' WHERE id = '3c734726-fd74-4780-a2b6-614f92b5c923';

-- Grant admin role to Virginia Raluvhona (Case Manager)
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '2809aec7-b20c-4b08-af0a-1fcd16ac8a9d';
UPDATE public.profiles SET role = 'admin' WHERE id = '2809aec7-b20c-4b08-af0a-1fcd16ac8a9d';

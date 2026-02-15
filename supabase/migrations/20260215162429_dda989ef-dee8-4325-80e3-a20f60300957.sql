-- Update Itebogeng Moloto's role to employee
UPDATE public.user_roles 
SET role = 'employee' 
WHERE user_id = '3c734726-fd74-4780-a2b6-614f92b5c923';

-- Insert employee role for Virginia Raluvhona (she has no entry)
INSERT INTO public.user_roles (user_id, role)
VALUES ('2809aec7-b20c-4b08-af0a-1fcd16ac8a9d', 'employee')
ON CONFLICT (user_id, role) DO NOTHING;
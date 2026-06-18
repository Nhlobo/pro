
ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles SET
  first_name = v.first_name,
  last_name = v.last_name,
  email = v.email,
  role = v.role_name,
  user_type = v.role_name,
  updated_at = now()
FROM (VALUES
  ('e65179d4-b784-4251-97a2-65df84a93e7e'::uuid, 'test.admin@medico-legal.test',    'admin',              'Test', 'Admin'),
  ('5b9e6382-fd4f-41f8-a7bb-60cf2736d544'::uuid, 'test.director@medico-legal.test', 'director',           'Test', 'Director'),
  ('41d290c2-4617-4be6-aa14-9208750f7024'::uuid, 'test.finance@medico-legal.test',  'finance',            'Test', 'Finance'),
  ('ce80fb06-71fc-4938-9637-3495e1ebece5'::uuid, 'test.employee@medico-legal.test', 'employee',           'Test', 'Employee'),
  ('1a71b881-cc16-4655-9b5b-1ae46f2e6551'::uuid, 'test.sales@medico-legal.test',    'sales_consultant',   'Test', 'SalesConsultant'),
  ('8b6d1c1d-f70f-4d92-b93f-f946fd571251'::uuid, 'test.expert@medico-legal.test',   'medical_expert',     'Test', 'Expert'),
  ('ef96ef67-f94f-421d-9953-b8477f0ebfde'::uuid, 'test.attorney@medico-legal.test', 'referring_attorney', 'Test', 'Attorney'),
  ('aed6836f-1506-4c8b-bde0-af1cfe9fb224'::uuid, 'test.user@medico-legal.test',     'user',               'Test', 'User')
) AS v(id, email, role_name, first_name, last_name)
WHERE public.profiles.id = v.id;

ALTER TABLE public.profiles ENABLE TRIGGER USER;

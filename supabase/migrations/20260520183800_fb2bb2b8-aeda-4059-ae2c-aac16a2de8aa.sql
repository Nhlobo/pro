
DELETE FROM public.user_roles WHERE user_id = 'ba2673d3-d8d0-4963-9d8f-dc34f199098c';
INSERT INTO public.user_roles (user_id, role) VALUES ('ba2673d3-d8d0-4963-9d8f-dc34f199098c', 'sales_consultant');

ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles
   SET role = 'sales_consultant', user_type = 'user'
 WHERE id = 'ba2673d3-d8d0-4963-9d8f-dc34f199098c';
ALTER TABLE public.profiles ENABLE TRIGGER USER;

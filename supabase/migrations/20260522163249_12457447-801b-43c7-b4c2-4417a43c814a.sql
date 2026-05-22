CREATE OR REPLACE FUNCTION public.get_internal_chat_users()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  "position" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (p.id)
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    ur.role::text AS role,
    p."position"
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE public.is_internal_user(auth.uid())
    AND ur.role::text IN ('admin','employee','sales_consultant','finance','director')
  ORDER BY p.id, p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_internal_chat_users() TO authenticated;
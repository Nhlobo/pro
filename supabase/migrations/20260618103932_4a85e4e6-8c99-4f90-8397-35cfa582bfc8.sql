CREATE OR REPLACE FUNCTION public.get_app_roles()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(e::text ORDER BY e::text)
  FROM unnest(enum_range(NULL::public.app_role)) AS e;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_roles() TO authenticated, service_role;
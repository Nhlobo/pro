
-- Server-side check: is a user granted a specific function permission?
CREATE OR REPLACE FUNCTION public.user_has_function_permission(
  _user_id uuid,
  _category text,
  _function text,
  _sub text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT granted
    FROM public.function_permissions
    WHERE user_id = _user_id
      AND function_category = _category
      AND function_name = _function
      AND sub_function IS NOT DISTINCT FROM _sub
    LIMIT 1
  ), false)
  OR public.is_system_admin();
$$;

-- Atomic bulk update of function permissions (admin only).
-- _changes is a JSONB array of objects:
--   [{ "category": "...", "function": "...", "sub": null|"...", "granted": true|false, "user_type": "..." }, ...]
-- Inserts missing rows; updates existing rows. Performed in a single transaction.
CREATE OR REPLACE FUNCTION public.bulk_update_function_permissions(
  _user_id uuid,
  _changes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  rec   jsonb;
  applied int := 0;
  default_user_type text;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'array' THEN
    RAISE EXCEPTION 'changes must be a JSON array';
  END IF;

  SELECT user_type INTO default_user_type
  FROM public.function_permissions
  WHERE user_id = _user_id
  LIMIT 1;

  FOR rec IN SELECT * FROM jsonb_array_elements(_changes)
  LOOP
    INSERT INTO public.function_permissions (
      user_id, function_category, function_name, sub_function,
      granted, user_type, granted_by, updated_at
    ) VALUES (
      _user_id,
      rec->>'category',
      rec->>'function',
      NULLIF(rec->>'sub', ''),
      COALESCE((rec->>'granted')::boolean, false),
      COALESCE(rec->>'user_type', default_user_type, 'employee'),
      actor,
      now()
    )
    ON CONFLICT (user_id, function_category, function_name, sub_function)
    DO UPDATE SET
      granted = EXCLUDED.granted,
      granted_by = EXCLUDED.granted_by,
      updated_at = now();

    applied := applied + 1;
  END LOOP;

  RETURN jsonb_build_object('applied', applied);
END;
$$;

-- Ensure the ON CONFLICT target exists; create unique index if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'function_permissions_user_cat_fn_sub_uniq'
  ) THEN
    CREATE UNIQUE INDEX function_permissions_user_cat_fn_sub_uniq
      ON public.function_permissions (
        user_id, function_category, function_name, (COALESCE(sub_function, ''))
      );
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION public.user_has_function_permission(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_function_permissions(uuid, jsonb) TO authenticated;

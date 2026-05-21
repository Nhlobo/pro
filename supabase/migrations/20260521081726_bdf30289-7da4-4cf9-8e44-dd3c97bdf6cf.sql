CREATE OR REPLACE FUNCTION public.bulk_update_function_permissions(_user_id uuid, _changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ON CONFLICT (user_id, function_category, function_name, COALESCE(sub_function, ''::text))
    DO UPDATE SET
      granted = EXCLUDED.granted,
      granted_by = EXCLUDED.granted_by,
      updated_at = now();

    applied := applied + 1;
  END LOOP;

  RETURN jsonb_build_object('applied', applied);
END;
$function$;
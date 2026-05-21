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
  inserted_count int := 0;
  updated_count int := 0;
  default_user_type text;
  v_sub text;
  v_existing_id uuid;
  v_was_insert boolean;
  v_returned_xmax bigint;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'array' THEN
    RAISE EXCEPTION 'changes must be a JSON array';
  END IF;

  RAISE LOG 'bulk_update_function_permissions START actor=% target_user=% change_count=%',
    actor, _user_id, jsonb_array_length(_changes);

  SELECT user_type INTO default_user_type
  FROM public.function_permissions
  WHERE user_id = _user_id
  LIMIT 1;

  RAISE LOG 'bulk_update_function_permissions resolved default_user_type=%', COALESCE(default_user_type, '<none>');

  FOR rec IN SELECT * FROM jsonb_array_elements(_changes)
  LOOP
    v_sub := NULLIF(rec->>'sub', '');

    -- Pre-lookup: does a matching row already exist?
    SELECT id INTO v_existing_id
    FROM public.function_permissions
    WHERE user_id = _user_id
      AND function_category = rec->>'category'
      AND function_name = rec->>'function'
      AND COALESCE(sub_function, ''::text) = COALESCE(v_sub, ''::text)
    LIMIT 1;

    RAISE LOG 'bulk_update_function_permissions row category=% function=% sub=% match_found=% existing_id=% granted=%',
      rec->>'category', rec->>'function', COALESCE(v_sub, '<null>'),
      (v_existing_id IS NOT NULL), v_existing_id, rec->>'granted';

    -- Upsert and capture whether it was an insert or update via xmax
    INSERT INTO public.function_permissions (
      user_id, function_category, function_name, sub_function,
      granted, user_type, granted_by, updated_at
    ) VALUES (
      _user_id,
      rec->>'category',
      rec->>'function',
      v_sub,
      COALESCE((rec->>'granted')::boolean, false),
      COALESCE(rec->>'user_type', default_user_type, 'employee'),
      actor,
      now()
    )
    ON CONFLICT (user_id, function_category, function_name, COALESCE(sub_function, ''::text))
    DO UPDATE SET
      granted = EXCLUDED.granted,
      granted_by = EXCLUDED.granted_by,
      updated_at = now()
    RETURNING xmax::text::bigint INTO v_returned_xmax;

    v_was_insert := (v_returned_xmax = 0);

    IF v_was_insert THEN
      inserted_count := inserted_count + 1;
    ELSE
      updated_count := updated_count + 1;
    END IF;

    RAISE LOG 'bulk_update_function_permissions row APPLIED path=% category=% function=% sub=%',
      CASE WHEN v_was_insert THEN 'INSERT' ELSE 'UPDATE' END,
      rec->>'category', rec->>'function', COALESCE(v_sub, '<null>');

    applied := applied + 1;
  END LOOP;

  RAISE LOG 'bulk_update_function_permissions DONE actor=% target_user=% applied=% inserted=% updated=%',
    actor, _user_id, applied, inserted_count, updated_count;

  RETURN jsonb_build_object(
    'applied', applied,
    'inserted', inserted_count,
    'updated', updated_count
  );
END;
$function$;
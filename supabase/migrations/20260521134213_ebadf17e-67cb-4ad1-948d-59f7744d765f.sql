CREATE OR REPLACE FUNCTION public.test_function_permissions_upsert()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_cat  text := '__test__';
  v_fn   text := '__test_fn__';
  v_sub  text := '__test_sub__';
  v_null_rows int;
  v_val_rows  int;
  v_null_granted boolean;
  v_val_granted  boolean;
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  -- Clean any leftovers from a previous failed run
  DELETE FROM public.function_permissions
   WHERE user_id = v_user OR function_category = v_cat;

  -- ---------- Case 1: sub_function IS NULL ----------
  INSERT INTO public.function_permissions (
    user_id, function_category, function_name, sub_function,
    granted, user_type, granted_by, updated_at
  ) VALUES (
    v_user, v_cat, v_fn, NULL,
    false, 'employee', v_actor, now()
  )
  ON CONFLICT (user_id, function_category, function_name, COALESCE(sub_function, ''::text))
  DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

  -- Second upsert with same key but granted=true — must UPDATE, not duplicate
  INSERT INTO public.function_permissions (
    user_id, function_category, function_name, sub_function,
    granted, user_type, granted_by, updated_at
  ) VALUES (
    v_user, v_cat, v_fn, NULL,
    true, 'employee', v_actor, now()
  )
  ON CONFLICT (user_id, function_category, function_name, COALESCE(sub_function, ''::text))
  DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

  SELECT COUNT(*), bool_or(granted)
    INTO v_null_rows, v_null_granted
    FROM public.function_permissions
   WHERE user_id = v_user AND function_category = v_cat
     AND function_name = v_fn AND sub_function IS NULL;

  IF v_null_rows <> 1 THEN
    DELETE FROM public.function_permissions WHERE user_id = v_user;
    RAISE EXCEPTION 'NULL sub_function upsert produced % rows (expected 1) — duplicate-row bug present', v_null_rows;
  END IF;
  IF v_null_granted IS DISTINCT FROM true THEN
    DELETE FROM public.function_permissions WHERE user_id = v_user;
    RAISE EXCEPTION 'NULL sub_function upsert did not update granted to true (got %)', v_null_granted;
  END IF;

  -- ---------- Case 2: sub_function has a value ----------
  INSERT INTO public.function_permissions (
    user_id, function_category, function_name, sub_function,
    granted, user_type, granted_by, updated_at
  ) VALUES (
    v_user, v_cat, v_fn, v_sub,
    false, 'employee', v_actor, now()
  )
  ON CONFLICT (user_id, function_category, function_name, COALESCE(sub_function, ''::text))
  DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

  INSERT INTO public.function_permissions (
    user_id, function_category, function_name, sub_function,
    granted, user_type, granted_by, updated_at
  ) VALUES (
    v_user, v_cat, v_fn, v_sub,
    true, 'employee', v_actor, now()
  )
  ON CONFLICT (user_id, function_category, function_name, COALESCE(sub_function, ''::text))
  DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

  SELECT COUNT(*), bool_or(granted)
    INTO v_val_rows, v_val_granted
    FROM public.function_permissions
   WHERE user_id = v_user AND function_category = v_cat
     AND function_name = v_fn AND sub_function = v_sub;

  IF v_val_rows <> 1 THEN
    DELETE FROM public.function_permissions WHERE user_id = v_user;
    RAISE EXCEPTION 'Valued sub_function upsert produced % rows (expected 1)', v_val_rows;
  END IF;
  IF v_val_granted IS DISTINCT FROM true THEN
    DELETE FROM public.function_permissions WHERE user_id = v_user;
    RAISE EXCEPTION 'Valued sub_function upsert did not update granted to true (got %)', v_val_granted;
  END IF;

  -- NULL and valued sub_function for same (user, cat, fn) must coexist as 2 distinct rows
  IF (SELECT COUNT(*) FROM public.function_permissions
        WHERE user_id = v_user AND function_category = v_cat AND function_name = v_fn) <> 2 THEN
    DELETE FROM public.function_permissions WHERE user_id = v_user;
    RAISE EXCEPTION 'NULL and valued sub_function rows did not coexist as 2 distinct rows';
  END IF;

  -- Cleanup
  DELETE FROM public.function_permissions WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'null_case_rows', v_null_rows,
    'valued_case_rows', v_val_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.test_function_permissions_upsert() FROM public;
GRANT EXECUTE ON FUNCTION public.test_function_permissions_upsert() TO anon, authenticated, service_role;

-- Run once at migration time as a hard gate
DO $$
DECLARE r jsonb;
BEGIN
  r := public.test_function_permissions_upsert();
  RAISE LOG 'test_function_permissions_upsert migration-time result: %', r;
END $$;
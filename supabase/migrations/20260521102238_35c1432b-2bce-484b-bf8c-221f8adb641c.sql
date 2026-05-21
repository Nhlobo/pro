CREATE OR REPLACE FUNCTION public.verify_function_permissions_indexes()
RETURNS TABLE (
  severity text,
  code text,
  message text,
  index_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_is_admin boolean;
  v_safe_exists boolean;
  v_legacy record;
BEGIN
  -- Admin gate
  SELECT public.has_role(auth.uid(), 'admin') INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Admin privileges required to verify function_permissions indexes';
  END IF;

  -- 1) Safe COALESCE-based unique index must exist
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'function_permissions'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%COALESCE(sub_function%'
  ) INTO v_safe_exists;

  IF v_safe_exists THEN
    RETURN QUERY SELECT
      'ok'::text,
      'safe_index_present'::text,
      'Safe NULL-tolerant unique index on (user_id, function_category, function_name, COALESCE(sub_function, '''')) is present.'::text,
      NULL::text;
  ELSE
    RETURN QUERY SELECT
      'error'::text,
      'safe_index_missing'::text,
      'Missing safe unique index using COALESCE(sub_function, ''''). Bulk upserts may create duplicate rows when sub_function is NULL.'::text,
      NULL::text;
  END IF;

  -- 2) Legacy raw unique index that treats NULLs as distinct
  FOR v_legacy IN
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'function_permissions'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%sub_function%'
      AND indexdef NOT ILIKE '%COALESCE%'
      AND indexdef NOT ILIKE '%NULLS NOT DISTINCT%'
  LOOP
    RETURN QUERY SELECT
      'warning'::text,
      'legacy_null_distinct_index'::text,
      format(
        'Legacy unique index "%s" treats NULL sub_function values as distinct. This re-introduces the duplicate-row bug on bulk upsert. Drop it or recreate WITH NULLS NOT DISTINCT.',
        v_legacy.indexname
      ),
      v_legacy.indexname;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_function_permissions_indexes() FROM public;
GRANT EXECUTE ON FUNCTION public.verify_function_permissions_indexes() TO authenticated;
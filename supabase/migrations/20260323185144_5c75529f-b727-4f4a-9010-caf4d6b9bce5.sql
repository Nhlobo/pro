
-- Create a function to find duplicate referring attorneys by name
CREATE OR REPLACE FUNCTION public.find_duplicate_referring_attorneys()
RETURNS TABLE(
  duplicate_group integer,
  attorney_id uuid,
  name text,
  contact_person text,
  province text,
  code text,
  claimant_count bigint,
  appointment_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH duplicate_names AS (
    SELECT 
      LOWER(TRIM(ra.name)) as normalized_name
    FROM public.referring_attorneys ra
    WHERE ra.is_system_company = false OR ra.is_system_company IS NULL
    GROUP BY LOWER(TRIM(ra.name))
    HAVING COUNT(*) > 1
  ),
  numbered_groups AS (
    SELECT 
      dn.normalized_name,
      ROW_NUMBER() OVER (ORDER BY dn.normalized_name) as group_num
    FROM duplicate_names dn
  )
  SELECT 
    ng.group_num::integer as duplicate_group,
    ra.id as attorney_id,
    ra.name::text,
    ra.contact_person::text,
    ra.province::text,
    ra.code::text,
    (SELECT COUNT(*) FROM public.claimants c WHERE c.referring_attorney_id = ra.id) as claimant_count,
    (SELECT COUNT(*) FROM public.appointments a WHERE a.referring_attorney_id = ra.id) as appointment_count,
    ra.created_at
  FROM public.referring_attorneys ra
  JOIN numbered_groups ng ON LOWER(TRIM(ra.name)) = ng.normalized_name
  WHERE ra.is_system_company = false OR ra.is_system_company IS NULL
  ORDER BY ng.group_num, 
    (SELECT COUNT(*) FROM public.claimants c WHERE c.referring_attorney_id = ra.id) +
    (SELECT COUNT(*) FROM public.appointments a WHERE a.referring_attorney_id = ra.id) DESC,
    ra.created_at ASC;
END;
$$;

-- Create a function to merge a single duplicate attorney into a primary
CREATE OR REPLACE FUNCTION public.merge_and_delete_duplicate_attorney(
  p_duplicate_attorney_id uuid,
  p_primary_attorney_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claimants_merged integer := 0;
  v_appointments_merged integer := 0;
  v_aod_docs_merged integer := 0;
  v_documents_merged integer := 0;
  v_profiles_merged integer := 0;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied. Admin privileges required.');
  END IF;

  -- Verify both attorneys exist
  IF NOT EXISTS (SELECT 1 FROM public.referring_attorneys WHERE id = p_primary_attorney_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Primary attorney not found.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.referring_attorneys WHERE id = p_duplicate_attorney_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate attorney not found.');
  END IF;

  -- Transfer claimants
  UPDATE public.claimants SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;
  GET DIAGNOSTICS v_claimants_merged = ROW_COUNT;

  -- Transfer appointments
  UPDATE public.appointments SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;
  GET DIAGNOSTICS v_appointments_merged = ROW_COUNT;

  -- Transfer AOD documents
  UPDATE public.aod_documents SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;
  GET DIAGNOSTICS v_aod_docs_merged = ROW_COUNT;

  -- Transfer documents
  UPDATE public.documents SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;
  GET DIAGNOSTICS v_documents_merged = ROW_COUNT;

  -- Transfer profiles
  UPDATE public.profiles SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;
  GET DIAGNOSTICS v_profiles_merged = ROW_COUNT;

  -- Transfer attorney access codes
  UPDATE public.attorney_access_codes SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;

  -- Transfer case timelines
  UPDATE public.case_timelines SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;

  -- Transfer appointment archives
  UPDATE public.appointment_archives SET referring_attorney_id = p_primary_attorney_id WHERE referring_attorney_id = p_duplicate_attorney_id;

  -- Delete the duplicate
  DELETE FROM public.referring_attorneys WHERE id = p_duplicate_attorney_id;

  RETURN jsonb_build_object(
    'success', true,
    'claimants_merged', v_claimants_merged,
    'appointments_merged', v_appointments_merged,
    'aod_docs_merged', v_aod_docs_merged,
    'documents_merged', v_documents_merged,
    'profiles_merged', v_profiles_merged
  );
END;
$$;

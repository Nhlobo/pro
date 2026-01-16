-- Drop the existing function first to allow changing return type
DROP FUNCTION IF EXISTS public.get_referring_attorneys_list();

-- Recreate with claimant and appointment counts
CREATE OR REPLACE FUNCTION public.get_referring_attorneys_list()
RETURNS TABLE(
  id uuid, 
  name text, 
  contact_person text, 
  attorney_role text, 
  province text, 
  code text, 
  created_at timestamp with time zone, 
  phone_masked text, 
  email_masked text,
  claimant_count bigint,
  appointment_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    ra.id, 
    ra.name, 
    ra.contact_person, 
    ra.attorney_role, 
    ra.province, 
    ra.code, 
    ra.created_at,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN ra.phone 
      ELSE public.mask_sensitive_data('phone', ra.phone)
    END as phone_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN ra.email 
      ELSE public.mask_sensitive_data('email', ra.email)
    END as email_masked,
    (SELECT COUNT(*) FROM public.claimants c WHERE c.referring_attorney_id = ra.id) as claimant_count,
    (SELECT COUNT(*) FROM public.appointments a WHERE a.referring_attorney_id = ra.id AND a.deleted_at IS NULL) as appointment_count
  FROM public.referring_attorneys ra
  WHERE 
    (ra.is_system_company = false OR ra.is_system_company IS NULL)
    AND
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      OR 
      ra.id = get_current_user_referring_attorney()
    )
  ORDER BY ra.name;
$function$;

-- Create a function to merge duplicate referring attorneys
CREATE OR REPLACE FUNCTION public.merge_duplicate_referring_attorneys()
RETURNS TABLE(duplicates_merged integer, records_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer := 0;
  updated_count integer := 0;
  duplicate_group RECORD;
  primary_id uuid;
  dup_id uuid;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required to merge duplicates.';
  END IF;

  -- Find duplicate attorneys based on name (case-insensitive)
  FOR duplicate_group IN
    SELECT 
      LOWER(TRIM(name)) as normalized_name,
      COUNT(*) as duplicate_count
    FROM public.referring_attorneys
    WHERE is_system_company = false OR is_system_company IS NULL
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  LOOP
    -- Get the primary attorney ID - prefer one with the most linked records
    SELECT ra.id INTO primary_id
    FROM public.referring_attorneys ra
    WHERE LOWER(TRIM(ra.name)) = duplicate_group.normalized_name
    ORDER BY 
      (SELECT COUNT(*) FROM claimants c WHERE c.referring_attorney_id = ra.id) +
      (SELECT COUNT(*) FROM appointments a WHERE a.referring_attorney_id = ra.id) DESC,
      ra.created_at ASC
    LIMIT 1;

    -- Move all related records to the primary attorney
    FOR dup_id IN
      SELECT ra.id
      FROM public.referring_attorneys ra
      WHERE LOWER(TRIM(ra.name)) = duplicate_group.normalized_name
        AND ra.id != primary_id
    LOOP
      -- Update claimants
      UPDATE public.claimants SET referring_attorney_id = primary_id WHERE referring_attorney_id = dup_id;
      updated_count := updated_count + 1;
      
      -- Update appointments
      UPDATE public.appointments SET referring_attorney_id = primary_id WHERE referring_attorney_id = dup_id;
      
      -- Update aod_documents
      UPDATE public.aod_documents SET referring_attorney_id = primary_id WHERE referring_attorney_id = dup_id;
      
      -- Update profiles
      UPDATE public.profiles SET referring_attorney_id = primary_id WHERE referring_attorney_id = dup_id;
      
      -- Update documents
      UPDATE public.documents SET referring_attorney_id = primary_id WHERE referring_attorney_id = dup_id;
      
      -- Delete the duplicate attorney
      DELETE FROM public.referring_attorneys WHERE id = dup_id;
      deleted_count := deleted_count + 1;
    END LOOP;
  END LOOP;

  -- Log the action
  PERFORM public.log_audit_trail(
    'referring_attorneys',
    NULL,
    'MERGE',
    'attorney_management',
    NULL,
    jsonb_build_object(
      'duplicates_merged', deleted_count,
      'records_updated', updated_count
    ),
    'Merged duplicate referring attorneys'
  );

  RETURN QUERY SELECT deleted_count, updated_count;
END;
$function$;
-- Create function to remove duplicate medical experts
-- Keeps the oldest record for each unique combination of first_name, last_name, and expert_type
CREATE OR REPLACE FUNCTION public.remove_duplicate_medical_experts()
RETURNS TABLE(duplicates_removed integer, kept_experts integer) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer := 0;
  kept_count integer := 0;
  duplicate_record RECORD;
BEGIN
  -- Check if user is admin or employee
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'employee')
    AND created_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin or employee privileges required to remove duplicates.';
  END IF;

  -- Find and delete duplicates, keeping the oldest record for each group
  FOR duplicate_record IN
    SELECT 
      first_name,
      last_name,
      expert_type,
      COUNT(*) as duplicate_count,
      MIN(created_at) as oldest_created_at
    FROM public.medical_experts
    GROUP BY first_name, last_name, expert_type
    HAVING COUNT(*) > 1
  LOOP
    -- Delete duplicates, keeping only the oldest one
    WITH deleted AS (
      DELETE FROM public.medical_experts
      WHERE first_name = duplicate_record.first_name
        AND last_name = duplicate_record.last_name
        AND expert_type = duplicate_record.expert_type
        AND created_at > duplicate_record.oldest_created_at
      RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    kept_count := kept_count + 1;
  END LOOP;

  -- Log the action
  PERFORM public.log_audit_trail(
    'medical_experts',
    NULL,
    'DELETE',
    'expert_management',
    NULL,
    jsonb_build_object(
      'duplicates_removed', deleted_count,
      'unique_experts_kept', kept_count
    ),
    'Removed duplicate medical experts'
  );

  RETURN QUERY SELECT deleted_count, kept_count;
END;
$$;
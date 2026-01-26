-- Function to merge duplicate expert data to a primary expert and then delete the duplicate
CREATE OR REPLACE FUNCTION merge_and_delete_duplicate_expert(
  p_duplicate_expert_id UUID,
  p_primary_expert_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointments_updated INTEGER := 0;
  v_expert_reports_updated INTEGER := 0;
  v_expert_payments_updated INTEGER := 0;
  v_documents_updated INTEGER := 0;
  v_duplicate_name TEXT;
  v_primary_name TEXT;
BEGIN
  -- Validate both experts exist
  SELECT first_name || ' ' || last_name INTO v_duplicate_name
  FROM medical_experts WHERE id = p_duplicate_expert_id;
  
  SELECT first_name || ' ' || last_name INTO v_primary_name
  FROM medical_experts WHERE id = p_primary_expert_id;
  
  IF v_duplicate_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Duplicate expert not found');
  END IF;
  
  IF v_primary_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Primary expert not found');
  END IF;
  
  IF p_duplicate_expert_id = p_primary_expert_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot merge expert with itself');
  END IF;

  -- Update appointments to point to primary expert
  UPDATE appointments 
  SET expert_id = p_primary_expert_id, updated_at = NOW()
  WHERE expert_id = p_duplicate_expert_id;
  GET DIAGNOSTICS v_appointments_updated = ROW_COUNT;

  -- Update expert_reports to point to primary expert
  UPDATE expert_reports 
  SET expert_id = p_primary_expert_id, updated_at = NOW()
  WHERE expert_id = p_duplicate_expert_id;
  GET DIAGNOSTICS v_expert_reports_updated = ROW_COUNT;

  -- Update expert_payments to point to primary expert
  UPDATE expert_payments 
  SET expert_id = p_primary_expert_id, updated_at = NOW()
  WHERE expert_id = p_duplicate_expert_id;
  GET DIAGNOSTICS v_expert_payments_updated = ROW_COUNT;

  -- Update documents to point to primary expert
  UPDATE documents 
  SET expert_id = p_primary_expert_id, updated_at = NOW()
  WHERE expert_id = p_duplicate_expert_id;
  GET DIAGNOSTICS v_documents_updated = ROW_COUNT;

  -- Delete the duplicate expert
  DELETE FROM medical_experts WHERE id = p_duplicate_expert_id;

  RETURN json_build_object(
    'success', true,
    'duplicate_expert', v_duplicate_name,
    'primary_expert', v_primary_name,
    'appointments_merged', v_appointments_updated,
    'expert_reports_merged', v_expert_reports_updated,
    'expert_payments_merged', v_expert_payments_updated,
    'documents_merged', v_documents_updated
  );
END;
$$;

-- Function to find potential duplicate experts (same first name and last name)
CREATE OR REPLACE FUNCTION find_duplicate_experts()
RETURNS TABLE (
  duplicate_group INTEGER,
  expert_id UUID,
  first_name TEXT,
  last_name TEXT,
  expert_type TEXT,
  province TEXT,
  status TEXT,
  appointment_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH duplicates AS (
    SELECT 
      LOWER(TRIM(me.first_name)) as fn,
      LOWER(TRIM(me.last_name)) as ln,
      COUNT(*) as cnt
    FROM medical_experts me
    GROUP BY LOWER(TRIM(me.first_name)), LOWER(TRIM(me.last_name))
    HAVING COUNT(*) > 1
  ),
  numbered_groups AS (
    SELECT 
      fn, ln,
      ROW_NUMBER() OVER (ORDER BY fn, ln) as group_num
    FROM duplicates
  )
  SELECT 
    ng.group_num::INTEGER as duplicate_group,
    me.id as expert_id,
    me.first_name,
    me.last_name,
    me.expert_type,
    me.province,
    me.status,
    COALESCE(apt_count.cnt, 0) as appointment_count,
    me.created_at
  FROM medical_experts me
  JOIN numbered_groups ng ON LOWER(TRIM(me.first_name)) = ng.fn AND LOWER(TRIM(me.last_name)) = ng.ln
  LEFT JOIN (
    SELECT expert_id, COUNT(*) as cnt 
    FROM appointments 
    WHERE deleted_at IS NULL
    GROUP BY expert_id
  ) apt_count ON apt_count.expert_id = me.id
  ORDER BY ng.group_num, me.created_at ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION merge_and_delete_duplicate_expert(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_duplicate_experts() TO authenticated;
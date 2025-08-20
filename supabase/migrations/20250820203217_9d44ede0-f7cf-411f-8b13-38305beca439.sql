-- Fix search_path security issues for the new functions

-- Update is_within_edit_window function
CREATE OR REPLACE FUNCTION public.is_within_edit_window(created_date TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN created_date > (now() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql STABLE SET search_path TO '';

-- Update can_edit_record function
CREATE OR REPLACE FUNCTION public.can_edit_record(
  table_name TEXT,
  record_id UUID,
  created_date TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admin can always edit
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Within 30 days, user can edit
  IF public.is_within_edit_window(created_date) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if there's an approved edit request for this record
  IF EXISTS (
    SELECT 1 FROM public.edit_requests 
    WHERE edit_requests.table_name = can_edit_record.table_name 
    AND edit_requests.record_id = can_edit_record.record_id 
    AND status = 'approved'
    AND requested_by = auth.uid()
    AND approved_at > (now() - INTERVAL '1 day') -- Approval valid for 1 day
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '';

-- Update request_edit_permission function
CREATE OR REPLACE FUNCTION public.request_edit_permission(
  p_table_name TEXT,
  p_record_id UUID,
  p_reason TEXT,
  p_requested_changes JSONB,
  p_original_data JSONB
)
RETURNS UUID AS $$
DECLARE
  request_id UUID;
BEGIN
  -- Check if user already has a pending request for this record
  IF EXISTS (
    SELECT 1 FROM public.edit_requests 
    WHERE table_name = p_table_name 
    AND record_id = p_record_id 
    AND requested_by = auth.uid()
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Edit request already exists for this record';
  END IF;
  
  -- Create edit request
  INSERT INTO public.edit_requests (
    table_name,
    record_id,
    requested_by,
    request_reason,
    requested_changes,
    original_data
  ) VALUES (
    p_table_name,
    p_record_id,
    auth.uid(),
    p_reason,
    p_requested_changes,
    p_original_data
  ) RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Update process_edit_request function
CREATE OR REPLACE FUNCTION public.process_edit_request(
  p_request_id UUID,
  p_status public.approval_status,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only administrators can process edit requests';
  END IF;
  
  -- Update request status
  UPDATE public.edit_requests 
  SET 
    status = p_status,
    approved_by = auth.uid(),
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_request_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
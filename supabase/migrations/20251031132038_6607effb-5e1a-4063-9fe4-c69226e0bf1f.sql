-- Drop and recreate functions with correct column names

DROP FUNCTION IF EXISTS public.get_scheduled_assessments_secure();
DROP FUNCTION IF EXISTS public.get_claimants_secure();
DROP FUNCTION IF EXISTS public.get_completed_reports_stats();

-- Recreate get_scheduled_assessments_secure with referring_attorney_id
CREATE FUNCTION public.get_scheduled_assessments_secure()
RETURNS TABLE(
  appointment_id uuid,
  claimant_auto_id text,
  claimant_name text,
  expert_name text,
  expert_type text,
  appointment_date timestamptz,
  deposit_amount numeric,
  payment_date timestamptz,
  case_status text,
  referring_attorney text,
  report_status text,
  report_submitted_date timestamptz,
  referring_attorney_id uuid,
  service_fee numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id as appointment_id,
    c.auto_id as claimant_auto_id,
    CONCAT(c.first_name, ' ', c.last_name) as claimant_name,
    CONCAT(me.first_name, ' ', me.last_name) as expert_name,
    me.expert_type,
    a.appointment_date,
    a.deposit_amount,
    a.payment_date,
    a.case_status,
    a.referring_attorney,
    COALESCE(er.report_status, 'not_received') as report_status,
    er.report_submitted_date,
    a.referring_attorney_id,
    a.service_fee
  FROM public.appointments a
  LEFT JOIN public.claimants c ON a.claimant_id = c.id
  LEFT JOIN public.medical_experts me ON a.expert_id = me.id
  LEFT JOIN public.expert_reports er ON a.id = er.appointment_id
  WHERE auth.uid() IS NOT NULL
    AND a.deleted_at IS NULL
    AND (
      public.is_system_admin()
      OR
      (
        public.get_current_user_referring_attorney() IS NOT NULL
        AND a.referring_attorney_id = public.get_current_user_referring_attorney()
      )
    )
  ORDER BY a.appointment_date DESC;
$$;

-- Recreate get_claimants_secure with referring_attorney_id
CREATE FUNCTION public.get_claimants_secure()
RETURNS TABLE(
  id uuid,
  auto_id text,
  first_name_masked text,
  last_name_masked text,
  contact_number_masked text,
  referring_attorney_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id,
    c.auto_id,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.first_name 
      ELSE public.mask_sensitive_data('address', c.first_name)
    END as first_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.last_name 
      ELSE public.mask_sensitive_data('address', c.last_name)
    END as last_name_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN c.contact_number 
      ELSE public.mask_sensitive_data('phone', c.contact_number)
    END as contact_number_masked,
    c.referring_attorney_id,
    c.created_at
  FROM public.claimants c
  WHERE c.referring_attorney_id = public.get_current_user_referring_attorney()
  ORDER BY c.created_at DESC;
$$;

-- Recreate get_completed_reports_stats with referring_attorney_id
CREATE FUNCTION public.get_completed_reports_stats()
RETURNS TABLE(
  total_completed bigint,
  completed_this_month bigint,
  completed_this_year bigint,
  last_completed_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_referring_attorney_id uuid;
BEGIN
  user_referring_attorney_id := public.get_current_user_referring_attorney();
  
  RETURN QUERY
  SELECT 
    dcr.completed_reports_count as total_completed,
    dcr.completed_this_month,
    dcr.completed_this_year,
    dcr.last_completed_date
  FROM public.dashboard_completed_reports dcr
  WHERE 
    (public.is_system_admin() OR dcr.law_firm_id = user_referring_attorney_id)
    AND dcr.law_firm_id IS NOT NULL
  LIMIT 1;
END;
$$;

-- Update remaining functions
CREATE OR REPLACE FUNCTION public.is_company_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'employee')
      AND referring_attorney_id IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.restore_appointment(appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  restored_appointment jsonb;
BEGIN
  UPDATE public.appointments
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    updated_at = now()
  WHERE id = appointment_id
  AND referring_attorney_id = get_current_user_referring_attorney()
  AND deleted_at IS NOT NULL
  RETURNING jsonb_build_object(
    'id', id,
    'claimant_id', claimant_id,
    'expert_id', expert_id,
    'appointment_date', appointment_date,
    'referring_attorney', referring_attorney,
    'restored', true
  ) INTO restored_appointment;

  IF restored_appointment IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or already restored';
  END IF;

  RETURN restored_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_appointment(appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.appointments
  SET 
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = appointment_id
  AND referring_attorney_id = get_current_user_referring_attorney();
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_assessment_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  appointments_deleted integer := 0;
  expert_reports_deleted integer := 0;
  archives_deleted integer := 0;
  result_json jsonb;
  user_referring_attorney_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required to clear assessment data.';
  END IF;

  SELECT referring_attorney_id INTO user_referring_attorney_id
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF user_referring_attorney_id IS NULL THEN
    DELETE FROM public.expert_reports;
    GET DIAGNOSTICS expert_reports_deleted = ROW_COUNT;
    
    DELETE FROM public.appointments;
    GET DIAGNOSTICS appointments_deleted = ROW_COUNT;
    
    DELETE FROM public.assessment_report_archives;
    GET DIAGNOSTICS archives_deleted = ROW_COUNT;
  ELSE
    DELETE FROM public.expert_reports 
    WHERE appointment_id IN (
      SELECT id FROM public.appointments 
      WHERE referring_attorney_id = user_referring_attorney_id
    );
    GET DIAGNOSTICS expert_reports_deleted = ROW_COUNT;
    
    DELETE FROM public.appointments 
    WHERE referring_attorney_id = user_referring_attorney_id;
    GET DIAGNOSTICS appointments_deleted = ROW_COUNT;
    
    DELETE FROM public.assessment_report_archives 
    WHERE referring_attorney_id = user_referring_attorney_id;
    GET DIAGNOSTICS archives_deleted = ROW_COUNT;
  END IF;

  result_json := jsonb_build_object(
    'appointments_deleted', appointments_deleted,
    'expert_reports_deleted', expert_reports_deleted,
    'archives_deleted', archives_deleted,
    'total_deleted', appointments_deleted + expert_reports_deleted + archives_deleted
  );

  PERFORM public.log_audit_trail(
    'assessment_data',
    NULL,
    'DELETE_ALL',
    'data_management',
    NULL,
    result_json,
    'Cleared all assessment data'
  );

  RETURN result_json;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_case_timeline_phases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO case_timelines (appointment_id, referring_attorney_id, phase_name, phase_order, status, started_at)
  VALUES
    (NEW.id, NEW.referring_attorney_id, 'Assessment', 1, 'in_progress', NEW.appointment_date),
    (NEW.id, NEW.referring_attorney_id, 'Preparation of Report', 2, 'pending', NULL),
    (NEW.id, NEW.referring_attorney_id, 'Report Review', 3, 'pending', NULL),
    (NEW.id, NEW.referring_attorney_id, 'Submission', 4, 'pending', NULL);
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_report_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appointment_record RECORD;
BEGIN
  IF (NEW.report_status IN ('completed', 'Report fully paid & submitted', 'taken_out', 'Taken Out') 
      AND (OLD.report_status IS NULL OR OLD.report_status != NEW.report_status)) THEN
    
    SELECT a.referring_attorney_id, a.id
    INTO v_appointment_record
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id;
    
    PERFORM public.log_audit_trail(
      'expert_reports',
      NEW.id,
      'UPDATE',
      'report_completion',
      jsonb_build_object(
        'old_status', OLD.report_status,
        'new_status', NEW.report_status
      ),
      jsonb_build_object(
        'appointment_id', NEW.appointment_id,
        'report_submitted_date', NEW.report_submitted_date,
        'referring_attorney_id', v_appointment_record.referring_attorney_id
      ),
      'Report marked as completed/delivered'
    );
    
    IF NEW.report_submitted_date IS NULL AND NEW.report_status IN ('completed', 'Report fully paid & submitted', 'taken_out', 'Taken Out') THEN
      NEW.report_submitted_date = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
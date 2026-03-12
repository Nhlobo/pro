DROP FUNCTION IF EXISTS public.get_scheduled_assessments_secure();

CREATE OR REPLACE FUNCTION public.get_scheduled_assessments_secure()
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
  service_fee numeric,
  assessment_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN QUERY
    SELECT
      a.id as appointment_id,
      c.auto_id as claimant_auto_id,
      (c.first_name || ' ' || c.last_name) as claimant_name,
      (me.name || ' ' || me.surname) as expert_name,
      me.expert_type,
      a.appointment_date,
      COALESCE(a.deposit_amount, 0) as deposit_amount,
      a.payment_date,
      COALESCE(a.case_status, 'scheduled') as case_status,
      a.referring_attorney,
      COALESCE(er.report_status, 'not_received') as report_status,
      er.report_submitted_date,
      a.referring_attorney_id,
      COALESCE(a.service_fee, 0) as service_fee,
      a.assessment_code
    FROM appointments a
    JOIN claimants c ON a.claimant_id = c.id
    JOIN medical_experts me ON a.expert_id = me.id
    LEFT JOIN expert_reports er ON er.appointment_id = a.id
    WHERE a.deleted_at IS NULL
    ORDER BY a.appointment_date DESC;
  ELSE
    RETURN QUERY
    SELECT
      a.id as appointment_id,
      c.auto_id as claimant_auto_id,
      (c.first_name || ' ' || c.last_name) as claimant_name,
      (me.name || ' ' || me.surname) as expert_name,
      me.expert_type,
      a.appointment_date,
      COALESCE(a.deposit_amount, 0) as deposit_amount,
      a.payment_date,
      COALESCE(a.case_status, 'scheduled') as case_status,
      a.referring_attorney,
      COALESCE(er.report_status, 'not_received') as report_status,
      er.report_submitted_date,
      a.referring_attorney_id,
      COALESCE(a.service_fee, 0) as service_fee,
      a.assessment_code
    FROM appointments a
    JOIN claimants c ON a.claimant_id = c.id
    JOIN medical_experts me ON a.expert_id = me.id
    LEFT JOIN expert_reports er ON er.appointment_id = a.id
    WHERE a.deleted_at IS NULL
      AND a.referring_attorney_id = (
        SELECT p.referring_attorney_id FROM profiles p WHERE p.id = auth.uid()
      )
    ORDER BY a.appointment_date DESC;
  END IF;
END;
$$;
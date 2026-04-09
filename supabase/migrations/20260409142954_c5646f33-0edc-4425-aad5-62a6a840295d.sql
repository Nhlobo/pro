
-- Drop the existing function first (return type changed)
DROP FUNCTION IF EXISTS public.get_scheduled_assessments_secure();

-- Recreate with sales_consultant_name field
CREATE OR REPLACE FUNCTION public.get_scheduled_assessments_secure()
RETURNS TABLE(
  appointment_id UUID,
  claimant_auto_id TEXT,
  claimant_name TEXT,
  expert_name TEXT,
  expert_type TEXT,
  appointment_date TIMESTAMPTZ,
  deposit_amount NUMERIC,
  payment_date TIMESTAMPTZ,
  case_status TEXT,
  referring_attorney TEXT,
  report_status TEXT,
  report_submitted_date TIMESTAMPTZ,
  referring_attorney_id UUID,
  service_fee NUMERIC,
  assessment_code TEXT,
  report_notes TEXT,
  sales_consultant_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') THEN
    RETURN QUERY
    SELECT
      a.id AS appointment_id,
      c.auto_id AS claimant_auto_id,
      (c.first_name || ' ' || c.last_name) AS claimant_name,
      (me.first_name || ' ' || me.last_name) AS expert_name,
      me.expert_type,
      a.appointment_date,
      COALESCE(a.deposit_amount, 0) AS deposit_amount,
      a.payment_date,
      COALESCE(a.case_status, 'scheduled') AS case_status,
      a.referring_attorney,
      COALESCE(er.report_status, 'not_received') AS report_status,
      er.report_submitted_date,
      a.referring_attorney_id,
      COALESCE(a.service_fee, 0) AS service_fee,
      a.assessment_code,
      er.notes AS report_notes,
      sc.name AS sales_consultant_name
    FROM public.appointments a
    JOIN public.claimants c ON a.claimant_id = c.id
    JOIN public.medical_experts me ON a.expert_id = me.id
    LEFT JOIN public.expert_reports er ON er.appointment_id = a.id
    LEFT JOIN public.sales_consultants sc ON sc.id = a.sales_consultant_id
    WHERE a.deleted_at IS NULL
    ORDER BY a.appointment_date DESC;
  ELSE
    RETURN QUERY
    SELECT
      a.id AS appointment_id,
      c.auto_id AS claimant_auto_id,
      (c.first_name || ' ' || c.last_name) AS claimant_name,
      (me.first_name || ' ' || me.last_name) AS expert_name,
      me.expert_type,
      a.appointment_date,
      COALESCE(a.deposit_amount, 0) AS deposit_amount,
      a.payment_date,
      COALESCE(a.case_status, 'scheduled') AS case_status,
      a.referring_attorney,
      COALESCE(er.report_status, 'not_received') AS report_status,
      er.report_submitted_date,
      a.referring_attorney_id,
      COALESCE(a.service_fee, 0) AS service_fee,
      a.assessment_code,
      er.notes AS report_notes,
      sc.name AS sales_consultant_name
    FROM public.appointments a
    JOIN public.claimants c ON a.claimant_id = c.id
    JOIN public.medical_experts me ON a.expert_id = me.id
    LEFT JOIN public.expert_reports er ON er.appointment_id = a.id
    LEFT JOIN public.sales_consultants sc ON sc.id = a.sales_consultant_id
    WHERE a.deleted_at IS NULL
      AND a.referring_attorney_id = (
        SELECT p.referring_attorney_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
      )
    ORDER BY a.appointment_date DESC;
  END IF;
END;
$$;

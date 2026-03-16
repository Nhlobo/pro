CREATE OR REPLACE FUNCTION public.get_scheduled_assessments_secure()
RETURNS TABLE(
  appointment_id uuid,
  claimant_auto_id text,
  claimant_name text,
  expert_name text,
  expert_type text,
  appointment_date timestamp with time zone,
  deposit_amount numeric,
  payment_date timestamp with time zone,
  case_status text,
  referring_attorney text,
  report_status text,
  report_submitted_date timestamp with time zone,
  referring_attorney_id uuid,
  service_fee numeric,
  assessment_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      a.assessment_code
    FROM public.appointments a
    JOIN public.claimants c ON a.claimant_id = c.id
    JOIN public.medical_experts me ON a.expert_id = me.id
    LEFT JOIN public.expert_reports er ON er.appointment_id = a.id
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
      a.assessment_code
    FROM public.appointments a
    JOIN public.claimants c ON a.claimant_id = c.id
    JOIN public.medical_experts me ON a.expert_id = me.id
    LEFT JOIN public.expert_reports er ON er.appointment_id = a.id
    WHERE a.deleted_at IS NULL
      AND a.referring_attorney_id = (
        SELECT p.referring_attorney_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
      )
    ORDER BY a.appointment_date DESC;
  END IF;
END;
$function$;
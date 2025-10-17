-- Drop and recreate get_scheduled_assessments_secure function to include service_fee
DROP FUNCTION IF EXISTS public.get_scheduled_assessments_secure();

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
  law_firm_id uuid,
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
    a.law_firm_id,
    a.service_fee
  FROM public.appointments a
  LEFT JOIN public.claimants c ON a.claimant_id = c.id
  LEFT JOIN public.medical_experts me ON a.expert_id = me.id
  LEFT JOIN public.expert_reports er ON a.id = er.appointment_id
  WHERE a.law_firm_id = public.get_current_user_law_firm()
    AND auth.uid() IS NOT NULL
  ORDER BY a.appointment_date DESC;
$$;
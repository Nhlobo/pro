-- Fix security definer view by dropping and recreating with security invoker
DROP VIEW IF EXISTS public.agreement_payment_status;

CREATE VIEW public.agreement_payment_status 
WITH (security_invoker = true)
AS
SELECT 
  id,
  'aod' as agreement_type,
  referring_attorney_id,
  total_contract_value,
  deposit_amount,
  payment_status,
  document_status,
  default_status,
  services_suspended,
  next_payment_date,
  last_payment_date,
  reports_released,
  total_reports_agreed,
  created_at
FROM public.aod_documents
UNION ALL
SELECT 
  id,
  'short_term' as agreement_type,
  referring_attorney_id,
  total_contract_value,
  deposit_amount,
  payment_status,
  document_status,
  default_status,
  services_suspended,
  next_payment_date,
  last_payment_date,
  reports_released,
  total_reports_agreed,
  created_at
FROM public.short_term_agreements;
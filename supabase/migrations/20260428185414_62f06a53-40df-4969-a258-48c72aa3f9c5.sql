CREATE OR REPLACE FUNCTION public.get_consultant_period_stats(p_start DATE, p_end DATE)
RETURNS TABLE (
  consultant_id UUID,
  raf_appts BIGINT,
  medneg_appts BIGINT,
  total_appts BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.sales_consultant_id AS consultant_id,
    COUNT(*) FILTER (WHERE LOWER(COALESCE(a.matter_type, '')) NOT LIKE '%neg%') AS raf_appts,
    COUNT(*) FILTER (WHERE LOWER(COALESCE(a.matter_type, '')) LIKE '%neg%') AS medneg_appts,
    COUNT(*) AS total_appts
  FROM public.appointments a
  WHERE a.deleted_at IS NULL
    AND a.sales_consultant_id IS NOT NULL
    AND a.appointment_date::date >= p_start
    AND a.appointment_date::date <= p_end
    AND (
      LOWER(COALESCE(a.matter_type, '')) IN ('mva', 'raf', 'road accident fund', 'medical negligence')
      OR LOWER(COALESCE(a.matter_type, '')) LIKE '%med%neg%'
    )
  GROUP BY a.sales_consultant_id;
$$;

CREATE OR REPLACE FUNCTION public.get_consultant_deal_details(p_start DATE, p_end DATE, p_consultant_id UUID DEFAULT NULL)
RETURNS TABLE (
  appointment_id UUID,
  consultant_id UUID,
  consultant_name TEXT,
  user_full_name TEXT,
  claimant_name TEXT,
  claimant_auto_id TEXT,
  appointment_date DATE,
  closed_date DATE,
  matter_type TEXT,
  payment_status TEXT,
  deposit_amount NUMERIC,
  service_fee NUMERIC,
  referring_attorney TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS appointment_id,
    sc.id AS consultant_id,
    sc.name AS consultant_name,
    trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS user_full_name,
    trim(c.first_name || ' ' || c.last_name) AS claimant_name,
    c.auto_id AS claimant_auto_id,
    a.appointment_date::date AS appointment_date,
    a.appointment_date::date AS closed_date,
    a.matter_type,
    a.payment_status,
    COALESCE(a.deposit_amount, 0)::NUMERIC AS deposit_amount,
    COALESCE(a.service_fee, 0)::NUMERIC AS service_fee,
    a.referring_attorney
  FROM public.appointments a
  JOIN public.sales_consultants sc ON sc.id = a.sales_consultant_id
  LEFT JOIN public.profiles p ON p.id = sc.user_id
  LEFT JOIN public.claimants c ON c.id = a.claimant_id
  WHERE a.deleted_at IS NULL
    AND a.sales_consultant_id IS NOT NULL
    AND (p_consultant_id IS NULL OR sc.id = p_consultant_id)
    AND a.appointment_date::date >= p_start
    AND a.appointment_date::date <= p_end
    AND (
      LOWER(COALESCE(a.matter_type, '')) IN ('mva', 'raf', 'road accident fund', 'medical negligence')
      OR LOWER(COALESCE(a.matter_type, '')) LIKE '%med%neg%'
    )
    AND (
      sc.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
  ORDER BY a.appointment_date DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_consultant_period_stats(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consultant_deal_details(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_consultant_period_stats(DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_consultant_deal_details(DATE, DATE, UUID) TO authenticated;

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
  GROUP BY a.sales_consultant_id;
$$;

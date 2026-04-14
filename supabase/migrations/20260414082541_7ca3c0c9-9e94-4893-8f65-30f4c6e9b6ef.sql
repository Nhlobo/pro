
CREATE OR REPLACE FUNCTION public.get_consultant_monthly_stats(p_month INTEGER, p_year INTEGER)
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
    AND EXTRACT(MONTH FROM a.appointment_date) = p_month
    AND EXTRACT(YEAR FROM a.appointment_date) = p_year
  GROUP BY a.sales_consultant_id;
$$;

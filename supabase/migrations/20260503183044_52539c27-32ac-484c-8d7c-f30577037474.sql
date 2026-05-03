CREATE OR REPLACE FUNCTION public.get_quarter_actuals_by_consultant(p_year integer)
RETURNS TABLE(quarter integer, sales_consultant_id uuid, total bigint, mva bigint, medneg bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(QUARTER FROM appointment_date)::int AS quarter,
    sales_consultant_id,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE matter_type = 'MVA')::bigint AS mva,
    COUNT(*) FILTER (WHERE matter_type = 'Medical Negligence')::bigint AS medneg
  FROM public.appointments
  WHERE deleted_at IS NULL
    AND EXTRACT(YEAR FROM appointment_date)::int = p_year
  GROUP BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.get_quarter_actuals_by_consultant(integer) TO authenticated, anon;
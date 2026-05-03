
CREATE OR REPLACE FUNCTION public.get_heatmap_experts_by_province()
RETURNS TABLE(province text, expert_type text, expert_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT province, expert_type, COUNT(*)::bigint
  FROM public.medical_experts
  WHERE status = 'active'
  GROUP BY province, expert_type;
$$;

REVOKE EXECUTE ON FUNCTION public.get_heatmap_experts_by_province() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_heatmap_experts_by_province() TO authenticated;

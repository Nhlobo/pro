CREATE OR REPLACE FUNCTION public.get_heatmap_demand_by_province()
RETURNS TABLE(province text, demand bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT me.province, COUNT(*)::bigint AS demand
  FROM public.appointments a
  JOIN public.medical_experts me ON me.id = a.expert_id
  WHERE a.deleted_at IS NULL
    AND a.appointment_date >= (now() - interval '12 months')
  GROUP BY me.province;
$$;

GRANT EXECUTE ON FUNCTION public.get_heatmap_demand_by_province() TO authenticated;
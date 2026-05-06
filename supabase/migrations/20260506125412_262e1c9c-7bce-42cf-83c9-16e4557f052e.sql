DROP FUNCTION IF EXISTS public.get_heatmap_experts_by_province();
CREATE OR REPLACE FUNCTION public.get_heatmap_experts_by_province()
 RETURNS TABLE(province text, expert_type text, matter_types text[], expert_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT province, expert_type, matter_types, COUNT(*)::bigint
  FROM public.medical_experts
  WHERE status = 'active'
  GROUP BY province, expert_type, matter_types;
$function$;
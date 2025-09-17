-- Fix function search path security warning
DROP FUNCTION IF EXISTS public.get_user_function_permissions(UUID);

CREATE OR REPLACE FUNCTION public.get_user_function_permissions(target_user_id UUID)
RETURNS TABLE(
  function_category TEXT,
  function_name TEXT,
  sub_function TEXT,
  granted BOOLEAN,
  user_type TEXT
) 
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT 
    fp.function_category,
    fp.function_name,
    fp.sub_function,
    fp.granted,
    fp.user_type
  FROM public.function_permissions fp
  WHERE fp.user_id = target_user_id
  AND (
    -- Admin can see all
    public.is_system_admin()
    OR 
    -- Users can see their own permissions
    fp.user_id = auth.uid()
  )
  ORDER BY fp.function_category, fp.function_name, fp.sub_function NULLS FIRST;
$$;
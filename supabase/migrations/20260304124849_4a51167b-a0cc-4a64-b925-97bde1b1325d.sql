-- Fix medical_experts RLS: Replace overly permissive policy with role-based access

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users full access to medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "System admin bypass for medical experts" ON public.medical_experts;

-- Allow all authenticated users to VIEW active experts (read-only)
CREATE POLICY "Authenticated users can view active medical experts"
ON public.medical_experts
FOR SELECT
TO authenticated
USING (true);

-- Only admins and employees can INSERT experts
CREATE POLICY "Admins and employees can create medical experts"
ON public.medical_experts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
);

-- Only admins and employees can UPDATE experts
CREATE POLICY "Admins and employees can update medical experts"
ON public.medical_experts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
);

-- Only admins can DELETE experts
CREATE POLICY "Only admins can delete medical experts"
ON public.medical_experts
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Fix SECURITY DEFINER functions missing search_path
-- Ensure all public SECURITY DEFINER functions have search_path set
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT p.proname, pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (p.proconfig IS NULL 
           OR NOT EXISTS (
             SELECT 1 FROM unnest(p.proconfig) AS cfg 
             WHERE cfg LIKE 'search_path=%'
           ))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I SET search_path = public', func_record.proname);
      RAISE NOTICE 'Fixed search_path for function: %', func_record.proname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not fix function % (may have overloads): %', func_record.proname, SQLERRM;
    END;
  END LOOP;
END $$;
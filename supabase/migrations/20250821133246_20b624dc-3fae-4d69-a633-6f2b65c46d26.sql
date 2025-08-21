-- Strengthen RLS policies for claimants table to prevent client data exposure

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view claimants from their law firm only" ON public.claimants;
DROP POLICY IF EXISTS "Authenticated users can create claimants for their law firm onl" ON public.claimants;
DROP POLICY IF EXISTS "Authenticated users can update claimants from their law firm on" ON public.claimants;
DROP POLICY IF EXISTS "Authenticated users can delete claimants from their law firm on" ON public.claimants;

-- Create more secure policies with additional validation
CREATE POLICY "Users can only view claimants from their law firm"
ON public.claimants FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND law_firm_id IS NOT NULL 
  AND get_current_user_law_firm() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND law_firm_id IS NOT NULL
    AND law_firm_id = claimants.law_firm_id
  )
);

CREATE POLICY "Users can only create claimants for their law firm"
ON public.claimants FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND law_firm_id IS NOT NULL 
  AND get_current_user_law_firm() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND law_firm_id IS NOT NULL
    AND law_firm_id = claimants.law_firm_id
  )
);

CREATE POLICY "Users can only update claimants from their law firm"
ON public.claimants FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND law_firm_id IS NOT NULL 
  AND get_current_user_law_firm() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND law_firm_id IS NOT NULL
    AND law_firm_id = claimants.law_firm_id
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND law_firm_id IS NOT NULL 
  AND get_current_user_law_firm() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND law_firm_id IS NOT NULL
    AND law_firm_id = claimants.law_firm_id
  )
);

CREATE POLICY "Users can only delete claimants from their law firm"
ON public.claimants FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND law_firm_id IS NOT NULL 
  AND get_current_user_law_firm() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND law_firm_id IS NOT NULL
    AND law_firm_id = claimants.law_firm_id
  )
);

-- Also strengthen the get_current_user_law_firm function with additional validation
CREATE OR REPLACE FUNCTION public.get_current_user_law_firm()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT law_firm_id 
  FROM public.profiles 
  WHERE id = auth.uid() 
  AND law_firm_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.law_firms lf 
    WHERE lf.id = profiles.law_firm_id
  );
$$;
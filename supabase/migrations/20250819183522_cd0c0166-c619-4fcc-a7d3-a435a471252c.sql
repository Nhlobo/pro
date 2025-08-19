-- Drop existing claimants policies that might have gaps
DROP POLICY IF EXISTS "Users can create claimants for their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can delete claimants from their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can update claimants from their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can view claimants from their law firm" ON public.claimants;

-- Create enhanced RLS policies for claimants table with stronger security
-- Policy for SELECT: Only authenticated users can view claimants from their law firm
CREATE POLICY "Authenticated users can view claimants from their law firm only" 
ON public.claimants 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND get_current_user_law_firm() IS NOT NULL
);

-- Policy for INSERT: Only authenticated users can create claimants for their law firm
CREATE POLICY "Authenticated users can create claimants for their law firm only" 
ON public.claimants 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND get_current_user_law_firm() IS NOT NULL
);

-- Policy for UPDATE: Only authenticated users can update claimants from their law firm
CREATE POLICY "Authenticated users can update claimants from their law firm only" 
ON public.claimants 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND get_current_user_law_firm() IS NOT NULL
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND get_current_user_law_firm() IS NOT NULL
);

-- Policy for DELETE: Only authenticated users can delete claimants from their law firm
CREATE POLICY "Authenticated users can delete claimants from their law firm only" 
ON public.claimants 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND law_firm_id = get_current_user_law_firm()
  AND get_current_user_law_firm() IS NOT NULL
);

-- Ensure RLS is enabled on claimants table
ALTER TABLE public.claimants ENABLE ROW LEVEL SECURITY;

-- Add additional security constraint to ensure law_firm_id is never null
-- This prevents orphaned claimant records without proper law firm association
ALTER TABLE public.claimants ALTER COLUMN law_firm_id SET NOT NULL;
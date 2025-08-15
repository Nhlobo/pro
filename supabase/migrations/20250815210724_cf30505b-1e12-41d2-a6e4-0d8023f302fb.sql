-- Update RLS policies for claimants to allow users to create claimants for any law firm
-- This allows users to create claimants and assign them to any referring attorney

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can create claimants for their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can view claimants from their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can update claimants from their law firm" ON public.claimants;
DROP POLICY IF EXISTS "Users can delete claimants from their law firm" ON public.claimants;

-- Create new more permissive policies for authenticated users
CREATE POLICY "Authenticated users can view all claimants" 
ON public.claimants 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create claimants" 
ON public.claimants 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update claimants" 
ON public.claimants 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete claimants" 
ON public.claimants 
FOR DELETE 
TO authenticated
USING (true);
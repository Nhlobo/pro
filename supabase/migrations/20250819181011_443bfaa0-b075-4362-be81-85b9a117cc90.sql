-- Fix security vulnerability: Restrict claimant access to law firm members only

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all claimants" ON public.claimants;
DROP POLICY IF EXISTS "Authenticated users can create claimants" ON public.claimants;
DROP POLICY IF EXISTS "Authenticated users can update claimants" ON public.claimants;
DROP POLICY IF EXISTS "Authenticated users can delete claimants" ON public.claimants;

-- Create secure policies that restrict access based on law firm
CREATE POLICY "Users can view claimants from their law firm" 
ON public.claimants 
FOR SELECT 
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create claimants for their law firm" 
ON public.claimants 
FOR INSERT 
WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can update claimants from their law firm" 
ON public.claimants 
FOR UPDATE 
USING (law_firm_id = get_current_user_law_firm())
WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete claimants from their law firm" 
ON public.claimants 
FOR DELETE 
USING (law_firm_id = get_current_user_law_firm());
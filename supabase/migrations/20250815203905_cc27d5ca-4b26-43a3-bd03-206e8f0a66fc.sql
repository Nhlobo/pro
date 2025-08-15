-- Add policy to allow authenticated users to insert law firms
CREATE POLICY "Authenticated users can create law firms" 
ON public.law_firms 
FOR INSERT 
TO authenticated
WITH CHECK (true);
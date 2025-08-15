-- Allow authenticated users to view all law firms (needed for claimant form dropdown)
CREATE POLICY "Authenticated users can view law firms"
ON public.law_firms
FOR SELECT
TO authenticated
USING (true);
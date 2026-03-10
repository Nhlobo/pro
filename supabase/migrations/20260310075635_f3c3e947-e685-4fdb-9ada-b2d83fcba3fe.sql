-- Allow sales consultants to view all appointments (needed for unattributed deals in Sales Report)
CREATE POLICY "Sales consultants can view all appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'sales_consultant'::app_role));
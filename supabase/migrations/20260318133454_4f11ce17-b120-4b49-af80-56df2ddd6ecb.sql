-- Allow employees to update appointments (for case status changes etc.)
CREATE POLICY "Employees can update appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'employee'::app_role));
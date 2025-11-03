-- Allow admins and employees to view all appointments for debt management
CREATE POLICY "Admins and employees can view all appointments for debt management"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'employee')
  OR referring_attorney_id IN (
    SELECT referring_attorney_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Allow admins and employees to view all AOD documents
CREATE POLICY "Admins and employees can view all AOD documents"
ON public.aod_documents
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'employee')
  OR referring_attorney_id IN (
    SELECT referring_attorney_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Allow admins and employees to view all expert reports
CREATE POLICY "Admins and employees can view all expert reports"
ON public.expert_reports
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'employee')
  OR EXISTS (
    SELECT 1 
    FROM public.appointments a
    INNER JOIN public.profiles p ON p.referring_attorney_id = a.referring_attorney_id
    WHERE a.id = expert_reports.appointment_id
    AND p.id = auth.uid()
  )
);
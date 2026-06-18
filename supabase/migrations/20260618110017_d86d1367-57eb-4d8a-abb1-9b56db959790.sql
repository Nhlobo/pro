
DROP POLICY IF EXISTS "Staff can view audit logs" ON public.audit_logs;
CREATE POLICY "Staff can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  (SELECT has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'employee'::app_role)
       OR has_role(auth.uid(), 'director'::app_role))
);

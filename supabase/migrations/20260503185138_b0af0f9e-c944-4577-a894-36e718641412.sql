
-- Helper: check if current user is admin or employee
CREATE OR REPLACE FUNCTION public.is_admin_or_employee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role IN ('admin','employee') OR user_type IN ('admin','staff','super_user','employee'))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_employee() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_employee() TO authenticated;

-- =========================================================
-- attorney_access_codes: drop overly permissive policy
-- =========================================================
DROP POLICY IF EXISTS "Service role can manage access codes" ON public.attorney_access_codes;
-- service_role bypasses RLS automatically; no replacement needed for service role.

-- =========================================================
-- case_management_reports: scope SELECT
-- =========================================================
DROP POLICY IF EXISTS "Users can view case management reports" ON public.case_management_reports;
CREATE POLICY "Staff or uploader can view case management reports"
  ON public.case_management_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = uploaded_by OR public.is_admin_or_employee());

-- =========================================================
-- appointment_checklist: restrict to admin/employee
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view checklist" ON public.appointment_checklist;
DROP POLICY IF EXISTS "Authenticated users can insert checklist" ON public.appointment_checklist;
DROP POLICY IF EXISTS "Authenticated users can update checklist" ON public.appointment_checklist;

CREATE POLICY "Staff can view checklist"
  ON public.appointment_checklist FOR SELECT
  TO authenticated
  USING (public.is_admin_or_employee());

CREATE POLICY "Staff can insert checklist"
  ON public.appointment_checklist FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_employee());

CREATE POLICY "Staff can update checklist"
  ON public.appointment_checklist FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

CREATE POLICY "Admins can delete checklist"
  ON public.appointment_checklist FOR DELETE
  TO authenticated
  USING (public.is_system_admin());

-- =========================================================
-- payment_report_allocations: restrict to admin/employee
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view payment allocations" ON public.payment_report_allocations;
DROP POLICY IF EXISTS "Authenticated users can insert payment allocations" ON public.payment_report_allocations;
DROP POLICY IF EXISTS "Authenticated users can delete payment allocations" ON public.payment_report_allocations;

CREATE POLICY "Staff can view payment allocations"
  ON public.payment_report_allocations FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_employee()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.referring_attorney_id IS NOT NULL
        AND p.referring_attorney_id = payment_report_allocations.referring_attorney_id
    )
  );

CREATE POLICY "Staff can insert payment allocations"
  ON public.payment_report_allocations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_employee());

CREATE POLICY "Staff can delete payment allocations"
  ON public.payment_report_allocations FOR DELETE
  TO authenticated
  USING (public.is_admin_or_employee());

-- =========================================================
-- email_queue: restrict to admin/employee for SELECT/UPDATE
-- =========================================================
DROP POLICY IF EXISTS "Email queue viewable by authenticated users" ON public.email_queue;
DROP POLICY IF EXISTS "Email queue updatable by authenticated users" ON public.email_queue;
DROP POLICY IF EXISTS "Email queue insertable by service role" ON public.email_queue;

CREATE POLICY "Staff can view email queue"
  ON public.email_queue FOR SELECT
  TO authenticated
  USING (public.is_admin_or_employee());

CREATE POLICY "Staff can update email queue"
  ON public.email_queue FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

CREATE POLICY "Authenticated can insert email queue"
  ON public.email_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =========================================================
-- sales_team_targets: SELECT all auth, writes admin-only
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view targets" ON public.sales_team_targets;
DROP POLICY IF EXISTS "Authenticated users can insert targets" ON public.sales_team_targets;
DROP POLICY IF EXISTS "Authenticated users can update targets" ON public.sales_team_targets;
DROP POLICY IF EXISTS "Authenticated users can delete targets" ON public.sales_team_targets;

CREATE POLICY "Authenticated can view targets"
  ON public.sales_team_targets FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert targets"
  ON public.sales_team_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_employee());

CREATE POLICY "Admins can update targets"
  ON public.sales_team_targets FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

CREATE POLICY "Admins can delete targets"
  ON public.sales_team_targets FOR DELETE
  TO authenticated
  USING (public.is_admin_or_employee());

-- =========================================================
-- STORAGE: tighten buckets
-- =========================================================

-- documents bucket
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

CREATE POLICY "Staff can view documents bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_admin_or_employee()));

CREATE POLICY "Staff can upload to documents bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.is_admin_or_employee());

CREATE POLICY "Staff can delete from documents bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_admin_or_employee()));

-- expert-documents bucket
DROP POLICY IF EXISTS "Authenticated users can view expert documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload expert documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update expert documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete expert documents" ON storage.objects;

CREATE POLICY "Staff view expert documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'expert-documents' AND (owner = auth.uid() OR public.is_admin_or_employee()));

CREATE POLICY "Staff upload expert documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'expert-documents' AND public.is_admin_or_employee());

CREATE POLICY "Staff update expert documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'expert-documents' AND public.is_admin_or_employee())
  WITH CHECK (bucket_id = 'expert-documents' AND public.is_admin_or_employee());

CREATE POLICY "Staff delete expert documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'expert-documents' AND public.is_admin_or_employee());

-- expert-pop-documents bucket
DROP POLICY IF EXISTS "Users can upload POP documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view POP documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete POP documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update POP documents" ON storage.objects;

CREATE POLICY "Staff view POP documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'expert-pop-documents' AND (owner = auth.uid() OR public.is_admin_or_employee()));

CREATE POLICY "Staff upload POP documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'expert-pop-documents' AND public.is_admin_or_employee());

CREATE POLICY "Staff update POP documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'expert-pop-documents' AND public.is_admin_or_employee())
  WITH CHECK (bucket_id = 'expert-pop-documents' AND public.is_admin_or_employee());

CREATE POLICY "Staff delete POP documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'expert-pop-documents' AND public.is_admin_or_employee());

-- attorney-documents bucket
DROP POLICY IF EXISTS "Users can view attorney documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attorney documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update attorney documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete attorney documents" ON storage.objects;

CREATE POLICY "Staff view attorney documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attorney-documents' AND (owner = auth.uid() OR public.is_admin_or_employee()));

CREATE POLICY "Staff upload attorney documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attorney-documents' AND public.is_admin_or_employee());

CREATE POLICY "Staff update attorney documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attorney-documents' AND public.is_admin_or_employee())
  WITH CHECK (bucket_id = 'attorney-documents' AND public.is_admin_or_employee());

CREATE POLICY "Staff delete attorney documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attorney-documents' AND public.is_admin_or_employee());

-- case-management-reports bucket
DROP POLICY IF EXISTS "Authenticated users can view case reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload case reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete case reports" ON storage.objects;

CREATE POLICY "Staff view case-management-reports bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'case-management-reports' AND (owner = auth.uid() OR public.is_admin_or_employee()));

CREATE POLICY "Staff upload case-management-reports bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'case-management-reports' AND public.is_admin_or_employee());

CREATE POLICY "Staff delete case-management-reports bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'case-management-reports' AND public.is_admin_or_employee());

-- sample-reports bucket: tighten writes to staff, keep reads for authenticated
DROP POLICY IF EXISTS "Allow authenticated users to upload sample reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their sample reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete sample reports" ON storage.objects;

CREATE POLICY "Staff upload sample reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sample-reports' AND public.is_admin_or_employee());

CREATE POLICY "Staff update sample reports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'sample-reports' AND public.is_admin_or_employee())
  WITH CHECK (bucket_id = 'sample-reports' AND public.is_admin_or_employee());

CREATE POLICY "Staff delete sample reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sample-reports' AND public.is_admin_or_employee());

-- short-term-agreements bucket: scope SELECT to user's own law firm
DROP POLICY IF EXISTS "Users can view agreement documents from their law firm" ON storage.objects;
CREATE POLICY "Users can view agreement documents from their law firm"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'short-term-agreements'
    AND (
      public.is_admin_or_employee()
      OR EXISTS (
        SELECT 1
        FROM public.short_term_agreements sta
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE sta.document_url = objects.name
          AND sta.referring_attorney_id = p.referring_attorney_id
          AND p.referring_attorney_id IS NOT NULL
      )
    )
  );

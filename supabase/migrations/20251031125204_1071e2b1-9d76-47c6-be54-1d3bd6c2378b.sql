-- Step 0: Drop any existing functions from previous migrations
DROP FUNCTION IF EXISTS public.get_current_user_referring_attorney() CASCADE;

-- Step 1: Rename the law_firms table to referring_attorneys
ALTER TABLE public.law_firms RENAME TO referring_attorneys;

-- Step 2: Rename all law_firm_id columns to referring_attorney_id
ALTER TABLE public.profiles RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.aod_documents RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.appointment_archives RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.appointment_requests RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.appointments RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.assessment_report_archives RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.attorneys RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.case_sources RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.case_timelines RENAME COLUMN law_firm_id TO referring_attorney_id;
ALTER TABLE public.claimants RENAME COLUMN law_firm_id TO referring_attorney_id;

-- Step 3: Drop the old function with CASCADE (this will drop all dependent policies)
DROP FUNCTION IF EXISTS public.get_current_user_law_firm() CASCADE;

-- Step 4: Create the new function with updated column name
CREATE OR REPLACE FUNCTION public.get_current_user_referring_attorney()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT referring_attorney_id
  FROM profiles
  WHERE id = auth.uid();
$$;

-- Step 5: Recreate all policies with new function and terminology
CREATE POLICY "Users can create appointments for their referring attorney" 
ON public.appointments FOR INSERT 
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can update appointments from their referring attorney" 
ON public.appointments FOR UPDATE 
USING (referring_attorney_id = get_current_user_referring_attorney())
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can delete appointments from their referring attorney" 
ON public.appointments FOR DELETE 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can view appointments from their referring attorney" 
ON public.appointments FOR SELECT 
USING ((referring_attorney_id = get_current_user_referring_attorney()) AND (deleted_at IS NULL));

CREATE POLICY "Users can view deleted appointments from their referring attorney" 
ON public.appointments FOR SELECT 
USING ((referring_attorney_id = get_current_user_referring_attorney()) AND (deleted_at IS NOT NULL));

CREATE POLICY "Users can view expert reports from their referring attorney" 
ON public.expert_reports FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.id = expert_reports.appointment_id 
  AND a.referring_attorney_id = get_current_user_referring_attorney()
));

CREATE POLICY "Users can create expert reports for their referring attorney" 
ON public.expert_reports FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM appointments
  WHERE appointments.id = expert_reports.appointment_id 
  AND appointments.referring_attorney_id = get_current_user_referring_attorney()
));

CREATE POLICY "Users can update expert reports from their referring attorney" 
ON public.expert_reports FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM appointments
  WHERE appointments.id = expert_reports.appointment_id 
  AND appointments.referring_attorney_id = get_current_user_referring_attorney()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM appointments
  WHERE appointments.id = expert_reports.appointment_id 
  AND appointments.referring_attorney_id = get_current_user_referring_attorney()
));

CREATE POLICY "Users can delete expert reports from their referring attorney" 
ON public.expert_reports FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM appointments
  WHERE appointments.id = expert_reports.appointment_id 
  AND appointments.referring_attorney_id = get_current_user_referring_attorney()
));

CREATE POLICY "Users can view archives from their referring attorney" 
ON public.appointment_archives FOR SELECT 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can create archives for their referring attorney" 
ON public.appointment_archives FOR INSERT 
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can view assessment archives from their referring attorney" 
ON public.assessment_report_archives FOR SELECT 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can create assessment archives for their referring attorney" 
ON public.assessment_report_archives FOR INSERT 
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can view case sources from their referring attorney" 
ON public.case_sources FOR SELECT 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can create case sources for their referring attorney" 
ON public.case_sources FOR INSERT 
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can update case sources from their referring attorney" 
ON public.case_sources FOR UPDATE 
USING (referring_attorney_id = get_current_user_referring_attorney())
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can delete case sources from their referring attorney" 
ON public.case_sources FOR DELETE 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can create appointment requests for their referring attorney" 
ON public.appointment_requests FOR INSERT 
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney() AND requested_by = auth.uid());

CREATE POLICY "Users can view appointment requests from their referring attorney" 
ON public.appointment_requests FOR SELECT 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Claimants INSERT - Restricted access" 
ON public.claimants FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL) 
  AND validate_claimant_access(referring_attorney_id) 
  AND (referring_attorney_id = get_current_user_referring_attorney())
);

CREATE POLICY "Claimants UPDATE - Admin and authorized access" 
ON public.claimants FOR UPDATE 
USING ((auth.uid() IS NOT NULL) AND (
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) 
  OR validate_claimant_access(referring_attorney_id)
))
WITH CHECK ((auth.uid() IS NOT NULL) AND (
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) 
  OR (validate_claimant_access(referring_attorney_id) AND referring_attorney_id = get_current_user_referring_attorney())
));

CREATE POLICY "Users can view AOD documents from their referring attorney" 
ON public.aod_documents FOR SELECT 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can create AOD documents for their referring attorney" 
ON public.aod_documents FOR INSERT 
WITH CHECK ((referring_attorney_id = get_current_user_referring_attorney()) AND (uploaded_by = auth.uid()));

CREATE POLICY "Users can update AOD documents from their referring attorney" 
ON public.aod_documents FOR UPDATE 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can delete AOD documents from their referring attorney" 
ON public.aod_documents FOR DELETE 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can view payments from their referring attorney" 
ON public.aod_payments FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM aod_documents
  WHERE aod_documents.id = aod_payments.aod_document_id 
  AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
));

CREATE POLICY "Users can create payments for their referring attorney" 
ON public.aod_payments FOR INSERT 
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM aod_documents
    WHERE aod_documents.id = aod_payments.aod_document_id 
    AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
  )) 
  AND (recorded_by = auth.uid())
);

CREATE POLICY "Users can update payments from their referring attorney" 
ON public.aod_payments FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM aod_documents
  WHERE aod_documents.id = aod_payments.aod_document_id 
  AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
));

CREATE POLICY "Role-based attorney access" 
ON public.attorneys FOR SELECT 
USING (is_system_admin() OR is_company_user() OR (referring_attorney_id = get_current_user_referring_attorney()));

CREATE POLICY "Users can view timelines from their referring attorney" 
ON public.case_timelines FOR SELECT 
USING (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can create timelines for their referring attorney" 
ON public.case_timelines FOR INSERT 
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can update timelines from their referring attorney" 
ON public.case_timelines FOR UPDATE 
USING (referring_attorney_id = get_current_user_referring_attorney())
WITH CHECK (referring_attorney_id = get_current_user_referring_attorney());

CREATE POLICY "Users can view own referring attorney only" 
ON public.referring_attorneys FOR SELECT 
USING (
  (auth.uid() IS NOT NULL) AND (id IS NOT NULL) AND 
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = auth.uid()) AND (p.referring_attorney_id = referring_attorneys.id) 
    AND (p.referring_attorney_id IS NOT NULL) AND (p.created_at IS NOT NULL) AND (p.created_at <= now())
  ))
);

-- Step 6: Update other functions
CREATE OR REPLACE FUNCTION public.get_referring_attorneys_list()
RETURNS TABLE(id uuid, name text, contact_person text, attorney_role text, province text, code text, created_at timestamp with time zone, phone_masked text, email_masked text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ra.id, 
    ra.name, 
    ra.contact_person, 
    ra.attorney_role, 
    ra.province, 
    ra.code, 
    ra.created_at,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN ra.phone 
      ELSE public.mask_sensitive_data('phone', ra.phone)
    END as phone_masked,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') 
      THEN ra.email 
      ELSE public.mask_sensitive_data('email', ra.email)
    END as email_masked
  FROM public.referring_attorneys ra
  WHERE 
    (ra.is_system_company = false OR ra.is_system_company IS NULL)
    AND
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      OR 
      ra.id = get_current_user_referring_attorney()
    )
  ORDER BY ra.name;
$$;

DROP FUNCTION IF EXISTS public.validate_claimant_access(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.validate_claimant_access(claimant_referring_attorney_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  SELECT id, referring_attorney_id, role, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND created_at IS NOT NULL 
    AND created_at <= now();
  
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF user_profile.role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  IF user_profile.referring_attorney_id IS NOT NULL 
     AND user_profile.referring_attorney_id = claimant_referring_attorney_id 
     AND claimant_referring_attorney_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;
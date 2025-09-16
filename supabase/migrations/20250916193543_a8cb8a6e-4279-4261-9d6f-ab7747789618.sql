-- Comprehensive admin access setup for boshomane@kutlwanoassociate.com
-- Fix RLS recursion issues and ensure full system access

-- 1. Create or replace security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_main_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (
      email = 'boshomane@kutlwanoassociate.com' 
      OR role = 'admin' 
      OR user_type = 'admin'
    )
    AND created_at IS NOT NULL
  );
$$;

-- 2. Create function to check if current user is any admin
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR user_type = 'admin')
    AND created_at IS NOT NULL
  );
$$;

-- 3. Ensure boshomane@kutlwanoassociate.com has proper admin setup
UPDATE public.profiles 
SET 
  role = 'admin',
  user_type = 'admin',
  updated_at = now()
WHERE email = 'boshomane@kutlwanoassociate.com';

-- 4. Add comprehensive admin policies for all key tables

-- Medical Experts - Full admin access
DROP POLICY IF EXISTS "Main admin full access to medical experts" ON public.medical_experts;
CREATE POLICY "Main admin full access to medical experts" ON public.medical_experts
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Law Firms - Full admin access  
DROP POLICY IF EXISTS "Main admin full access to law firms" ON public.law_firms;
CREATE POLICY "Main admin full access to law firms" ON public.law_firms
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Claimants - Full admin access
DROP POLICY IF EXISTS "Main admin full access to claimants" ON public.claimants;
CREATE POLICY "Main admin full access to claimants" ON public.claimants
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Appointments - Full admin access
DROP POLICY IF EXISTS "Main admin full access to appointments" ON public.appointments;
CREATE POLICY "Main admin full access to appointments" ON public.appointments
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Documents - Full admin access
DROP POLICY IF EXISTS "Main admin full access to documents" ON public.documents;
CREATE POLICY "Main admin full access to documents" ON public.documents
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Expert Reports - Full admin access
DROP POLICY IF EXISTS "Main admin full access to expert reports" ON public.expert_reports;
CREATE POLICY "Main admin full access to expert reports" ON public.expert_reports
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Attorneys - Full admin access
DROP POLICY IF EXISTS "Main admin full access to attorneys" ON public.attorneys;
CREATE POLICY "Main admin full access to attorneys" ON public.attorneys
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Leads - Full admin access
DROP POLICY IF EXISTS "Main admin full access to leads" ON public.leads;
CREATE POLICY "Main admin full access to leads" ON public.leads
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Appointment Requests - Full admin access
DROP POLICY IF EXISTS "Main admin full access to appointment requests" ON public.appointment_requests;
CREATE POLICY "Main admin full access to appointment requests" ON public.appointment_requests
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Case Sources - Full admin access
DROP POLICY IF EXISTS "Main admin full access to case sources" ON public.case_sources;
CREATE POLICY "Main admin full access to case sources" ON public.case_sources
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Targets - Full admin access
DROP POLICY IF EXISTS "Main admin full access to targets" ON public.targets;
CREATE POLICY "Main admin full access to targets" ON public.targets
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Pitch Logs - Full admin access
DROP POLICY IF EXISTS "Main admin full access to pitch logs" ON public.pitch_logs;
CREATE POLICY "Main admin full access to pitch logs" ON public.pitch_logs
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- User Permissions - Full admin access
DROP POLICY IF EXISTS "Main admin full access to user permissions" ON public.user_permissions;
CREATE POLICY "Main admin full access to user permissions" ON public.user_permissions
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Employee Notifications - Full admin access
DROP POLICY IF EXISTS "Main admin full access to employee notifications" ON public.employee_notifications;
CREATE POLICY "Main admin full access to employee notifications" ON public.employee_notifications
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Edit Requests - Full admin access
DROP POLICY IF EXISTS "Main admin full access to edit requests" ON public.edit_requests;
CREATE POLICY "Main admin full access to edit requests" ON public.edit_requests
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Archives - Full admin access
DROP POLICY IF EXISTS "Main admin full access to appointment archives" ON public.appointment_archives;
CREATE POLICY "Main admin full access to appointment archives" ON public.appointment_archives
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "Main admin full access to assessment archives" ON public.assessment_report_archives;
CREATE POLICY "Main admin full access to assessment archives" ON public.assessment_report_archives
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Lead Search History - Full admin access
DROP POLICY IF EXISTS "Main admin full access to lead search history" ON public.lead_search_history;
CREATE POLICY "Main admin full access to lead search history" ON public.lead_search_history
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Appointment Request Ratings - Full admin access
DROP POLICY IF EXISTS "Main admin full access to appointment request ratings" ON public.appointment_request_ratings;
CREATE POLICY "Main admin full access to appointment request ratings" ON public.appointment_request_ratings
FOR ALL USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- 5. Grant storage access for admin
INSERT INTO storage.objects (bucket_id, name, owner, metadata) 
VALUES ('expert-documents', 'admin/.keep', '99f79b02-e597-4fcb-8556-874004dd9f5f', '{}')
ON CONFLICT DO NOTHING;

INSERT INTO storage.objects (bucket_id, name, owner, metadata) 
VALUES ('attorney-documents', 'admin/.keep', '99f79b02-e597-4fcb-8556-874004dd9f5f', '{}')
ON CONFLICT DO NOTHING;

INSERT INTO storage.objects (bucket_id, name, owner, metadata) 
VALUES ('sample-reports', 'admin/.keep', '99f79b02-e597-4fcb-8556-874004dd9f5f', '{}')
ON CONFLICT DO NOTHING;

-- 6. Create storage policies for admin access
CREATE POLICY IF NOT EXISTS "Admin full access to all storage" ON storage.objects
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR user_type = 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR user_type = 'admin')
  )
);

-- 7. Add comment for documentation
COMMENT ON FUNCTION public.is_main_admin() IS 
'Security definer function to check if current user is main admin. Prevents RLS recursion by not referencing the same table in policies.';

COMMENT ON FUNCTION public.is_system_admin() IS 
'Security definer function to check if current user has admin privileges. Used in RLS policies to avoid recursion.';
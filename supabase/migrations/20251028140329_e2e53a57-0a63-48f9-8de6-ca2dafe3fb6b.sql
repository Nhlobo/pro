-- Ensure System Administrators have full unrestricted access to ALL tables
-- This adds admin bypass policies where missing and ensures is_system_admin() works correctly

-- First, ensure is_system_admin() function is robust
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'employee')
  )
  OR has_role(auth.uid(), 'admin');
$$;

-- Add comprehensive admin bypass policies for all major tables
-- These policies ensure system admins can do ANYTHING on ANY row

-- Appointments: Full admin access
DROP POLICY IF EXISTS "System admins full access to appointments" ON public.appointments;
CREATE POLICY "System admins full access to appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Claimants: Full admin access
DROP POLICY IF EXISTS "System admins full access to claimants" ON public.claimants;
CREATE POLICY "System admins full access to claimants"
ON public.claimants
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Medical Experts: Full admin access
DROP POLICY IF EXISTS "System admins full access to medical experts" ON public.medical_experts;
CREATE POLICY "System admins full access to medical experts"
ON public.medical_experts
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Expert Reports: Full admin access
DROP POLICY IF EXISTS "System admins full access to expert reports" ON public.expert_reports;
CREATE POLICY "System admins full access to expert reports"
ON public.expert_reports
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Documents: Full admin access
DROP POLICY IF EXISTS "System admins full access to documents" ON public.documents;
CREATE POLICY "System admins full access to documents"
ON public.documents
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Law Firms: Full admin access
DROP POLICY IF EXISTS "System admins full access to law firms" ON public.law_firms;
CREATE POLICY "System admins full access to law firms"
ON public.law_firms
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- AOD Documents: Full admin access
DROP POLICY IF EXISTS "System admins full access to aod documents" ON public.aod_documents;
CREATE POLICY "System admins full access to aod documents"
ON public.aod_documents
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- AOD Payments: Full admin access
DROP POLICY IF EXISTS "System admins full access to aod payments" ON public.aod_payments;
CREATE POLICY "System admins full access to aod payments"
ON public.aod_payments
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Appointment Requests: Full admin access
DROP POLICY IF EXISTS "System admins full access to appointment requests" ON public.appointment_requests;
CREATE POLICY "System admins full access to appointment requests"
ON public.appointment_requests
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Appointment Archives: Full admin access
DROP POLICY IF EXISTS "System admins full access to appointment archives" ON public.appointment_archives;
CREATE POLICY "System admins full access to appointment archives"
ON public.appointment_archives
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Assessment Report Archives: Full admin access
DROP POLICY IF EXISTS "System admins full access to assessment archives" ON public.assessment_report_archives;
CREATE POLICY "System admins full access to assessment archives"
ON public.assessment_report_archives
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Attorneys: Full admin access
DROP POLICY IF EXISTS "System admins full access to attorneys" ON public.attorneys;
CREATE POLICY "System admins full access to attorneys"
ON public.attorneys
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Case Sources: Full admin access
DROP POLICY IF EXISTS "System admins full access to case sources" ON public.case_sources;
CREATE POLICY "System admins full access to case sources"
ON public.case_sources
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Edit Requests: Full admin access
DROP POLICY IF EXISTS "System admins full access to edit requests" ON public.edit_requests;
CREATE POLICY "System admins full access to edit requests"
ON public.edit_requests
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Leads: Full admin access
DROP POLICY IF EXISTS "System admins full access to leads" ON public.leads;
CREATE POLICY "System admins full access to leads"
ON public.leads
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Lead Search History: Full admin access
DROP POLICY IF EXISTS "System admins full access to lead search history" ON public.lead_search_history;
CREATE POLICY "System admins full access to lead search history"
ON public.lead_search_history
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Pitch Logs: Full admin access
DROP POLICY IF EXISTS "System admins full access to pitch logs" ON public.pitch_logs;
CREATE POLICY "System admins full access to pitch logs"
ON public.pitch_logs
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Case Management Reports: Full admin access
DROP POLICY IF EXISTS "System admins full access to case management reports" ON public.case_management_reports;
CREATE POLICY "System admins full access to case management reports"
ON public.case_management_reports
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Employee Notifications: Full admin access
DROP POLICY IF EXISTS "System admins full access to employee notifications" ON public.employee_notifications;
CREATE POLICY "System admins full access to employee notifications"
ON public.employee_notifications
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Profiles: Full admin access to view all profiles
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;
CREATE POLICY "System admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_system_admin());

DROP POLICY IF EXISTS "System admins can update all profiles" ON public.profiles;
CREATE POLICY "System admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());
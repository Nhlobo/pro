-- Migration to ensure system admins have full access to all system functions
-- while maintaining law firm isolation for regular users

-- First, let's ensure the helper functions exist and work correctly
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND (user_type = 'admin' OR role = 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_law_firm()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT law_firm_id
  FROM profiles
  WHERE id = auth.uid();
$$;

-- Update profiles table policies for better admin access
DROP POLICY IF EXISTS "System admins have full access to all profiles" ON public.profiles;
CREATE POLICY "System admins have full access to all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure appointments table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for appointments" ON public.appointments;
CREATE POLICY "System admins bypass for appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure claimants table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for claimants" ON public.claimants;
CREATE POLICY "System admins bypass for claimants"
ON public.claimants
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure documents table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for documents" ON public.documents;
CREATE POLICY "System admins bypass for documents"
ON public.documents
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure law_firms table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for law_firms" ON public.law_firms;
CREATE POLICY "System admins bypass for law_firms"
ON public.law_firms
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure attorneys table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for attorneys" ON public.attorneys;
CREATE POLICY "System admins bypass for attorneys"
ON public.attorneys
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure appointment_requests table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for appointment_requests" ON public.appointment_requests;
CREATE POLICY "System admins bypass for appointment_requests"
ON public.appointment_requests
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure expert_reports table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for expert_reports" ON public.expert_reports;
CREATE POLICY "System admins bypass for expert_reports"
ON public.expert_reports
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Ensure function_permissions table has proper admin bypass
DROP POLICY IF EXISTS "System admins bypass for function_permissions" ON public.function_permissions;
CREATE POLICY "System admins bypass for function_permissions"
ON public.function_permissions
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());
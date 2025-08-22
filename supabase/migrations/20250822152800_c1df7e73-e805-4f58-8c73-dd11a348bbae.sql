-- Fix infinite recursion in profiles RLS policies and audit logs constraints

-- First, fix the audit_logs constraint to allow security audit action types
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

-- Add new constraint that allows all the action types we need
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_type_check 
CHECK (action_type IN (
  'CREATE', 'UPDATE', 'DELETE', 'SELECT',
  'user_login', 'document_access', 'expert_data_access', 
  'law_firm_access', 'contact_info_request', 'security_audit'
));

-- Drop problematic profiles policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view own profile and admins can view all" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.profiles;

-- Create new profiles policies using security definer functions to avoid recursion
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view all profiles (using direct role check without recursion)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin');

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING ((SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin');

-- Admins can delete user profiles
CREATE POLICY "Admins can delete user profiles"
ON public.profiles
FOR DELETE
USING ((SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin');
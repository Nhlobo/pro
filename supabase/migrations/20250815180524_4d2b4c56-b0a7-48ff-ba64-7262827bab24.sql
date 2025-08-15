-- First, create a security definer function to get the current user's role
-- This prevents infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Drop the existing overly permissive policies on medical_experts
DROP POLICY IF EXISTS "Authenticated users can create medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Authenticated users can delete medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Authenticated users can update medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Authenticated users can view medical experts" ON public.medical_experts;

-- Create new role-based policies for medical_experts
-- Only admins can create medical experts
CREATE POLICY "Only admins can create medical experts" 
ON public.medical_experts 
FOR INSERT 
TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

-- Only admins can update medical experts
CREATE POLICY "Only admins can update medical experts" 
ON public.medical_experts 
FOR UPDATE 
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- Only admins can delete medical experts
CREATE POLICY "Only admins can delete medical experts" 
ON public.medical_experts 
FOR DELETE 
TO authenticated
USING (public.get_current_user_role() = 'admin');

-- All authenticated users can view medical experts (for directory purposes)
-- This could be further restricted based on business requirements
CREATE POLICY "Authenticated users can view medical experts directory" 
ON public.medical_experts 
FOR SELECT 
TO authenticated
USING (true);
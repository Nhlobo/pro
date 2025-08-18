-- Fix security vulnerability in expert_reports table
-- Replace overly permissive RLS policies with law firm-based access control

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view expert reports" ON public.expert_reports;
DROP POLICY IF EXISTS "Authenticated users can create expert reports" ON public.expert_reports;
DROP POLICY IF EXISTS "Authenticated users can update expert reports" ON public.expert_reports;
DROP POLICY IF EXISTS "Authenticated users can delete expert reports" ON public.expert_reports;

-- Create secure law firm-based policies for expert reports
-- Users can only view expert reports from appointments belonging to their law firm
CREATE POLICY "Users can view expert reports from their law firm" 
ON public.expert_reports 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = expert_reports.appointment_id 
    AND appointments.law_firm_id = get_current_user_law_firm()
  )
);

-- Users can only create expert reports for appointments from their law firm
CREATE POLICY "Users can create expert reports for their law firm" 
ON public.expert_reports 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = expert_reports.appointment_id 
    AND appointments.law_firm_id = get_current_user_law_firm()
  )
);

-- Users can only update expert reports from their law firm
CREATE POLICY "Users can update expert reports from their law firm" 
ON public.expert_reports 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = expert_reports.appointment_id 
    AND appointments.law_firm_id = get_current_user_law_firm()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = expert_reports.appointment_id 
    AND appointments.law_firm_id = get_current_user_law_firm()
  )
);

-- Users can only delete expert reports from their law firm
CREATE POLICY "Users can delete expert reports from their law firm" 
ON public.expert_reports 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = expert_reports.appointment_id 
    AND appointments.law_firm_id = get_current_user_law_firm()
  )
);
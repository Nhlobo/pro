-- Add attorney_id foreign key to appointments table
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS attorney_id uuid REFERENCES public.attorneys(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_attorney_id ON public.appointments(attorney_id);

-- Update get_scheduled_assessments_secure to filter by attorney instead of law firm
DROP FUNCTION IF EXISTS public.get_scheduled_assessments_secure();

CREATE OR REPLACE FUNCTION public.get_scheduled_assessments_secure()
RETURNS TABLE(
  appointment_id uuid,
  claimant_auto_id text,
  claimant_name text,
  expert_name text,
  expert_type text,
  appointment_date timestamp with time zone,
  deposit_amount numeric,
  payment_date timestamp with time zone,
  case_status text,
  referring_attorney text,
  report_status text,
  report_submitted_date timestamp with time zone,
  law_firm_id uuid,
  service_fee numeric,
  attorney_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id as appointment_id,
    c.auto_id as claimant_auto_id,
    CONCAT(c.first_name, ' ', c.last_name) as claimant_name,
    CONCAT(me.first_name, ' ', me.last_name) as expert_name,
    me.expert_type,
    a.appointment_date,
    a.deposit_amount,
    a.payment_date,
    a.case_status,
    a.referring_attorney,
    COALESCE(er.report_status, 'not_received') as report_status,
    er.report_submitted_date,
    a.law_firm_id,
    a.service_fee,
    a.attorney_id
  FROM public.appointments a
  LEFT JOIN public.claimants c ON a.claimant_id = c.id
  LEFT JOIN public.medical_experts me ON a.expert_id = me.id
  LEFT JOIN public.expert_reports er ON a.id = er.appointment_id
  LEFT JOIN public.attorneys att ON a.attorney_id = att.id
  WHERE auth.uid() IS NOT NULL
    AND a.deleted_at IS NULL
    AND (
      -- Allow system admins to see all
      is_system_admin()
      OR
      -- Allow users to see appointments from their law firm OR their attorney records
      a.law_firm_id = public.get_current_user_law_firm()
      OR
      -- Allow attorneys to see their own appointments
      EXISTS (
        SELECT 1 FROM public.attorneys
        WHERE attorneys.id = a.attorney_id
        AND attorneys.created_by = auth.uid()
      )
    )
  ORDER BY a.appointment_date DESC;
$$;

-- Update RLS policies for appointments to include attorney-based access
DROP POLICY IF EXISTS "Users can view appointments by attorney" ON public.appointments;
CREATE POLICY "Users can view appointments by attorney"
ON public.appointments
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND deleted_at IS NULL
  AND (
    law_firm_id = get_current_user_law_firm()
    OR
    EXISTS (
      SELECT 1 FROM public.attorneys
      WHERE attorneys.id = appointments.attorney_id
      AND attorneys.created_by = auth.uid()
    )
  )
);
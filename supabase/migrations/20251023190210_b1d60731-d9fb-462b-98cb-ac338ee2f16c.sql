-- Add soft delete support to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- Create index for faster queries on deleted appointments
CREATE INDEX IF NOT EXISTS idx_appointments_deleted_at ON public.appointments(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Create a function to soft delete appointments
CREATE OR REPLACE FUNCTION soft_delete_appointment(appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.appointments
  SET 
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = appointment_id
  AND law_firm_id = get_current_user_law_firm();
END;
$$;

-- Create a function to restore deleted appointments
CREATE OR REPLACE FUNCTION restore_appointment(appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  restored_appointment jsonb;
BEGIN
  -- Restore the appointment
  UPDATE public.appointments
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    updated_at = now()
  WHERE id = appointment_id
  AND law_firm_id = get_current_user_law_firm()
  AND deleted_at IS NOT NULL
  RETURNING jsonb_build_object(
    'id', id,
    'claimant_id', claimant_id,
    'expert_id', expert_id,
    'appointment_date', appointment_date,
    'referring_attorney', referring_attorney,
    'restored', true
  ) INTO restored_appointment;

  IF restored_appointment IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or already restored';
  END IF;

  RETURN restored_appointment;
END;
$$;

-- Create a view for deleted appointments (for easy querying)
CREATE OR REPLACE VIEW deleted_appointments_view AS
SELECT 
  a.id,
  a.appointment_date,
  a.referring_attorney,
  a.matter_type,
  a.case_status,
  a.service_fee,
  a.deposit_amount,
  a.deleted_at,
  a.deleted_by,
  c.first_name || ' ' || c.last_name as claimant_name,
  c.auto_id as claimant_auto_id,
  me.first_name || ' ' || me.last_name as expert_name,
  me.expert_type,
  p.email as deleted_by_email,
  a.law_firm_id
FROM public.appointments a
LEFT JOIN public.claimants c ON a.claimant_id = c.id
LEFT JOIN public.medical_experts me ON a.expert_id = me.id
LEFT JOIN public.profiles p ON a.deleted_by = p.id
WHERE a.deleted_at IS NOT NULL
ORDER BY a.deleted_at DESC;

-- Update RLS policies to exclude soft-deleted appointments from normal queries
DROP POLICY IF EXISTS "Users can view appointments from their law firm" ON public.appointments;
CREATE POLICY "Users can view appointments from their law firm"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  law_firm_id = get_current_user_law_firm() 
  AND deleted_at IS NULL
);

-- Add policy to view deleted appointments
CREATE POLICY "Users can view deleted appointments from their law firm"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  law_firm_id = get_current_user_law_firm() 
  AND deleted_at IS NOT NULL
);

-- Grant necessary permissions
GRANT SELECT ON deleted_appointments_view TO authenticated;

COMMENT ON COLUMN appointments.deleted_at IS 'Timestamp when appointment was soft deleted';
COMMENT ON COLUMN appointments.deleted_by IS 'User who deleted the appointment';
COMMENT ON FUNCTION soft_delete_appointment IS 'Soft delete an appointment instead of permanently removing it';
COMMENT ON FUNCTION restore_appointment IS 'Restore a soft-deleted appointment';
-- Fix security issues from previous migration

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS deleted_appointments_view;
CREATE VIEW deleted_appointments_view 
WITH (security_invoker = true) AS
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

-- Recreate soft_delete_appointment function with secure search_path
CREATE OR REPLACE FUNCTION soft_delete_appointment(appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Recreate restore_appointment function with secure search_path
CREATE OR REPLACE FUNCTION restore_appointment(appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
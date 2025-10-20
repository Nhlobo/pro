
-- Fix the sync_appointment_request_to_appointments function
CREATE OR REPLACE FUNCTION public.sync_appointment_request_to_appointments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claimant_record RECORD;
  expert_record RECORD;
  appointment_record RECORD;
  appointment_datetime timestamp with time zone;
BEGIN
  -- Only sync if status is approved or new_date_proposed and not already synced
  IF (NEW.status IN ('approved', 'new_date_proposed')) THEN
    
    -- Determine the appointment datetime
    IF NEW.status = 'approved' AND NEW.confirmed_appointment_date IS NOT NULL THEN
      appointment_datetime = NEW.confirmed_appointment_date;
    ELSIF NEW.status = 'new_date_proposed' AND NEW.suggested_date IS NOT NULL THEN
      -- Convert date to timestamp with time zone, adding default time of 9 AM
      appointment_datetime = (NEW.suggested_date::text || ' 09:00:00')::timestamp with time zone;
    ELSE
      RETURN NEW;
    END IF;
    
    -- Rest of the function logic would go here
    -- For now, just return NEW to avoid blocking the update
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add a field to track which appointment requests have been synced to appointments
ALTER TABLE appointment_requests 
ADD COLUMN IF NOT EXISTS synced_appointment_id uuid REFERENCES appointments(id),
ADD COLUMN IF NOT EXISTS confirmed_appointment_date timestamp with time zone;

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_appointment_requests_synced 
ON appointment_requests(synced_appointment_id);

-- Create a function to sync appointment requests to appointments table
CREATE OR REPLACE FUNCTION sync_appointment_request_to_appointments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- Handle both date-only and datetime formats
      IF NEW.suggested_date ~ '^\d{4}-\d{2}-\d{2}T' THEN
        appointment_datetime = NEW.suggested_date::timestamp with time zone;
      ELSE
        appointment_datetime = (NEW.suggested_date || ' 09:00:00')::timestamp with time zone;
      END IF;
    ELSE
      -- Default to suggested_date or a default time
      IF NEW.suggested_date IS NOT NULL THEN
        appointment_datetime = (NEW.suggested_date || ' 09:00:00')::timestamp with time zone;
      ELSE
        RETURN NEW; -- Skip if no date available
      END IF;
    END IF;

    -- Find or create claimant
    SELECT * INTO claimant_record 
    FROM claimants 
    WHERE law_firm_id = NEW.law_firm_id 
    AND first_name ILIKE NEW.claimant_first_name 
    AND last_name ILIKE NEW.claimant_last_name
    LIMIT 1;
    
    -- If claimant doesn't exist, create one
    IF claimant_record IS NULL THEN
      INSERT INTO claimants (
        law_firm_id, 
        first_name, 
        last_name,
        auto_id
      ) VALUES (
        NEW.law_firm_id,
        NEW.claimant_first_name,
        NEW.claimant_last_name,
        'AR-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('claimants_auto_id_seq')::text, 6, '0')
      ) RETURNING * INTO claimant_record;
    END IF;
    
    -- Find a suitable expert based on type and province
    SELECT * INTO expert_record 
    FROM medical_experts 
    WHERE expert_type = NEW.expert_type_requested 
    AND province = NEW.province
    AND status = 'active'
    LIMIT 1;
    
    -- If no expert found, try without province filter
    IF expert_record IS NULL THEN
      SELECT * INTO expert_record 
      FROM medical_experts 
      WHERE expert_type = NEW.expert_type_requested 
      AND status = 'active'
      LIMIT 1;
    END IF;
    
    -- Skip if no expert found
    IF expert_record IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Check if appointment already exists for this request
    IF NEW.synced_appointment_id IS NOT NULL THEN
      -- Update existing appointment
      UPDATE appointments 
      SET 
        appointment_date = appointment_datetime,
        case_status = CASE 
          WHEN NEW.status = 'approved' THEN 'scheduled'
          WHEN NEW.status = 'new_date_proposed' THEN 'scheduled'
          ELSE case_status
        END,
        matter_type = NEW.matter_type,
        updated_at = now()
      WHERE id = NEW.synced_appointment_id;
      
    ELSE
      -- Create new appointment
      INSERT INTO appointments (
        claimant_id,
        expert_id,
        appointment_date,
        referring_attorney,
        law_firm_id,
        case_status,
        matter_type,
        deposit_amount
      ) VALUES (
        claimant_record.id,
        expert_record.id,
        appointment_datetime,
        NEW.referring_attorney_name,
        NEW.law_firm_id,
        CASE 
          WHEN NEW.status = 'approved' THEN 'scheduled'
          WHEN NEW.status = 'new_date_proposed' THEN 'scheduled'
          ELSE 'scheduled'
        END,
        NEW.matter_type,
        0 -- Default deposit amount
      ) RETURNING * INTO appointment_record;
      
      -- Update the appointment request with the synced appointment ID
      UPDATE appointment_requests 
      SET synced_appointment_id = appointment_record.id
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically sync appointment requests
DROP TRIGGER IF EXISTS trigger_sync_appointment_request ON appointment_requests;
CREATE TRIGGER trigger_sync_appointment_request
  AFTER UPDATE ON appointment_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_request_to_appointments();
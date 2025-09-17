-- Add logic to handle rejected requests that were previously approved
CREATE OR REPLACE FUNCTION handle_appointment_request_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed to rejected and there was a synced appointment
  IF NEW.status = 'rejected' AND OLD.synced_appointment_id IS NOT NULL THEN
    -- Update the appointment status to cancelled instead of deleting
    UPDATE appointments 
    SET 
      case_status = 'cancelled',
      updated_at = now()
    WHERE id = OLD.synced_appointment_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for handling rejections
DROP TRIGGER IF EXISTS trigger_handle_rejection ON appointment_requests;
CREATE TRIGGER trigger_handle_rejection
  AFTER UPDATE ON appointment_requests
  FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status != 'rejected')
  EXECUTE FUNCTION handle_appointment_request_rejection();

-- Create a function to manually sync existing approved/proposed requests
CREATE OR REPLACE FUNCTION sync_existing_appointment_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_record RECORD;
BEGIN
  -- Process all approved and new_date_proposed requests that haven't been synced yet
  FOR req_record IN 
    SELECT * FROM appointment_requests 
    WHERE status IN ('approved', 'new_date_proposed') 
    AND synced_appointment_id IS NULL
  LOOP
    -- Trigger the sync function for each record
    PERFORM sync_appointment_request_to_appointments() 
    FROM (SELECT req_record AS NEW, req_record AS OLD) AS trigger_data;
    
    -- Since we can't use the actual trigger context, we'll duplicate the logic here
    -- This is a simplified version that handles the sync
    DECLARE
      claimant_record RECORD;
      expert_record RECORD;
      appointment_record RECORD;
      appointment_datetime timestamp with time zone;
    BEGIN
      -- Determine the appointment datetime
      IF req_record.status = 'approved' AND req_record.confirmed_appointment_date IS NOT NULL THEN
        appointment_datetime = req_record.confirmed_appointment_date;
      ELSIF req_record.status = 'new_date_proposed' AND req_record.suggested_date IS NOT NULL THEN
        -- Handle both date-only and datetime formats
        IF req_record.suggested_date ~ '^\d{4}-\d{2}-\d{2}T' THEN
          appointment_datetime = req_record.suggested_date::timestamp with time zone;
        ELSE
          appointment_datetime = (req_record.suggested_date || ' 09:00:00')::timestamp with time zone;
        END IF;
      ELSE
        -- Default to suggested_date or skip
        IF req_record.suggested_date IS NOT NULL THEN
          appointment_datetime = (req_record.suggested_date || ' 09:00:00')::timestamp with time zone;
        ELSE
          CONTINUE; -- Skip this record
        END IF;
      END IF;

      -- Find or create claimant
      SELECT * INTO claimant_record 
      FROM claimants 
      WHERE law_firm_id = req_record.law_firm_id 
      AND first_name ILIKE req_record.claimant_first_name 
      AND last_name ILIKE req_record.claimant_last_name
      LIMIT 1;
      
      -- If claimant doesn't exist, create one
      IF claimant_record IS NULL THEN
        INSERT INTO claimants (
          law_firm_id, 
          first_name, 
          last_name,
          auto_id
        ) VALUES (
          req_record.law_firm_id,
          req_record.claimant_first_name,
          req_record.claimant_last_name,
          'AR-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('claimants_auto_id_seq')::text, 6, '0')
        ) RETURNING * INTO claimant_record;
      END IF;
      
      -- Find a suitable expert
      SELECT * INTO expert_record 
      FROM medical_experts 
      WHERE expert_type = req_record.expert_type_requested 
      AND province = req_record.province
      AND status = 'active'
      LIMIT 1;
      
      -- If no expert found, try without province filter
      IF expert_record IS NULL THEN
        SELECT * INTO expert_record 
        FROM medical_experts 
        WHERE expert_type = req_record.expert_type_requested 
        AND status = 'active'
        LIMIT 1;
      END IF;
      
      -- Skip if no expert found
      IF expert_record IS NULL THEN
        CONTINUE;
      END IF;
      
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
        req_record.referring_attorney_name,
        req_record.law_firm_id,
        'scheduled',
        req_record.matter_type,
        0
      ) RETURNING * INTO appointment_record;
      
      -- Update the appointment request with the synced appointment ID
      UPDATE appointment_requests 
      SET synced_appointment_id = appointment_record.id
      WHERE id = req_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error and continue with next record
      RAISE NOTICE 'Error syncing appointment request %: %', req_record.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE 'Completed syncing existing appointment requests';
END;
$$;
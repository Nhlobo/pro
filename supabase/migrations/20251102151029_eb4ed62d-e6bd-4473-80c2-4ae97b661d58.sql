-- Create a trigger to automatically generate AOD documents when appointments are created with AOD payment terms

-- First, create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION trigger_auto_generate_aod()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if payment terms includes AOD
  IF NEW.payment_terms IS NOT NULL AND (
    LOWER(NEW.payment_terms) LIKE '%aod%' OR 
    LOWER(NEW.payment_terms) LIKE '%agreement on demand%'
  ) THEN
    -- Call the edge function asynchronously using pg_net
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-generate-aod',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'record', jsonb_build_object(
            'id', NEW.id,
            'referring_attorney_id', NEW.referring_attorney_id,
            'payment_terms', NEW.payment_terms,
            'service_fee', NEW.service_fee,
            'deposit_amount', NEW.deposit_amount,
            'agreement_duration_months', NEW.agreement_duration_months,
            'appointment_date', NEW.appointment_date,
            'claimant_id', NEW.claimant_id,
            'referring_attorney', NEW.referring_attorney
          )
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on appointments table
DROP TRIGGER IF EXISTS auto_generate_aod_trigger ON appointments;

CREATE TRIGGER auto_generate_aod_trigger
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_aod();

-- Add comment for documentation
COMMENT ON TRIGGER auto_generate_aod_trigger ON appointments IS 
'Automatically generates AOD documents when appointments are created with AOD payment terms';

COMMENT ON FUNCTION trigger_auto_generate_aod() IS 
'Workflow: Generate auto AOD - Triggers when an appointment is created with AOD payment option';

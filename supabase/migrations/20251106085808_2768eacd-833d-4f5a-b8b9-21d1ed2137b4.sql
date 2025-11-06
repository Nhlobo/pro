-- Create function to send appointment confirmation email automatically
CREATE OR REPLACE FUNCTION send_appointment_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  v_attorney_email TEXT;
  v_attorney_name TEXT;
  v_claimant_name TEXT;
  v_expert_name TEXT;
  v_expert_email TEXT;
  v_location TEXT;
  v_appointment_time TEXT;
BEGIN
  -- Only proceed if case_status is 'scheduled'
  IF NEW.case_status = 'scheduled' THEN
    -- Get referring attorney email and name
    SELECT 
      ra.email,
      ra.name
    INTO 
      v_attorney_email,
      v_attorney_name
    FROM referring_attorneys ra
    WHERE ra.id = NEW.referring_attorney_id;
    
    -- Get claimant name
    SELECT 
      CONCAT(first_name, ' ', last_name)
    INTO 
      v_claimant_name
    FROM claimants
    WHERE id = NEW.claimant_id;
    
    -- Get expert details
    SELECT 
      CONCAT(first_name, ' ', last_name),
      email
    INTO 
      v_expert_name,
      v_expert_email
    FROM medical_experts
    WHERE id = NEW.expert_id;
    
    -- Extract time from appointment_date or use a default
    v_appointment_time := TO_CHAR(NEW.appointment_date, 'HH24:MI');
    
    -- Set default location if not provided
    v_location := COALESCE(
      (SELECT location FROM medical_experts WHERE id = NEW.expert_id),
      'TBD'
    );
    
    -- Call the edge function asynchronously (fire and forget)
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-appointment-confirmation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'appointmentData', jsonb_build_object(
            'id', NEW.id,
            'claimant_name', v_claimant_name,
            'expert_name', v_expert_name,
            'expert_email', v_expert_email,
            'attorney_name', v_attorney_name,
            'attorney_email', v_attorney_email,
            'appointment_date', NEW.appointment_date,
            'appointment_time', v_appointment_time,
            'matter_type', COALESCE(NEW.matter_type, 'Medical Assessment'),
            'service_fee', COALESCE(NEW.service_fee, 0),
            'location', v_location
          )
        )
      );
      
    RAISE LOG 'Appointment confirmation email triggered for appointment: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new appointments
DROP TRIGGER IF EXISTS trigger_send_appointment_confirmation ON appointments;
CREATE TRIGGER trigger_send_appointment_confirmation
  AFTER INSERT OR UPDATE OF case_status, appointment_date
  ON appointments
  FOR EACH ROW
  WHEN (NEW.case_status = 'scheduled')
  EXECUTE FUNCTION send_appointment_confirmation_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION send_appointment_confirmation_email() TO authenticated;
GRANT EXECUTE ON FUNCTION send_appointment_confirmation_email() TO service_role;
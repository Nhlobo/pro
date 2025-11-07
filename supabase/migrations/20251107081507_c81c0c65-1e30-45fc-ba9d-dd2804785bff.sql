-- Create function to automatically send appointment confirmation emails
CREATE OR REPLACE FUNCTION public.send_appointment_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  function_url text;
  request_body jsonb;
  http_response jsonb;
BEGIN
  -- Only send email if status is 'Scheduled' or 'scheduled'
  IF NEW.case_status IS NOT NULL AND LOWER(NEW.case_status) = 'scheduled' THEN
    -- Get Supabase URL from environment
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Build the function URL
    function_url := supabase_url || '/functions/v1/send-appointment-confirmation';
    
    -- Build request body
    request_body := jsonb_build_object(
      'appointmentId', NEW.id::text
    );
    
    -- Log the email trigger
    RAISE NOTICE 'Triggering appointment confirmation email for appointment %', NEW.id;
    
    -- Invoke the edge function asynchronously using pg_net extension
    PERFORM
      net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := request_body
      );
      
    -- Log to audit trail
    INSERT INTO public.audit_logs (
      user_id,
      action_type,
      table_name,
      record_id,
      description,
      function_area,
      user_email,
      new_values
    ) VALUES (
      auth.uid(),
      'EMAIL_SENT',
      'appointments',
      NEW.id,
      'Automatic appointment confirmation email triggered for status: ' || NEW.case_status,
      'Email Automation',
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      jsonb_build_object(
        'appointment_id', NEW.id,
        'case_status', NEW.case_status,
        'email_type', 'appointment_confirmation'
      )
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_send_appointment_confirmation ON public.appointments;

-- Create trigger that fires after INSERT or UPDATE on appointments
CREATE TRIGGER trigger_send_appointment_confirmation
  AFTER INSERT OR UPDATE OF case_status
  ON public.appointments
  FOR EACH ROW
  WHEN (NEW.case_status IS NOT NULL AND LOWER(NEW.case_status) = 'scheduled')
  EXECUTE FUNCTION public.send_appointment_confirmation_email();

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.send_appointment_confirmation_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_appointment_confirmation_email() TO service_role;

COMMENT ON FUNCTION public.send_appointment_confirmation_email() IS 'Automatically sends appointment confirmation emails to referring attorneys when appointment status is set to Scheduled';
COMMENT ON TRIGGER trigger_send_appointment_confirmation ON public.appointments IS 'Triggers automatic appointment confirmation email when status changes to Scheduled';
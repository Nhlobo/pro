-- Disable automatic appointment confirmation email triggers
-- All emails will be sent manually until auto-send is re-enabled

-- Drop the trigger that automatically sends emails when appointments are created/updated
DROP TRIGGER IF EXISTS trigger_send_appointment_confirmation ON public.appointments;

-- Keep the function for potential manual use later, but it won't be automatically triggered
COMMENT ON FUNCTION public.send_appointment_confirmation_email() IS 'Email sending function - currently disabled for automatic triggers. Emails must be sent manually.';
COMMENT ON FUNCTION public.trigger_appointment_confirmation_email() IS 'Email trigger function - currently disabled. Emails must be sent manually.';
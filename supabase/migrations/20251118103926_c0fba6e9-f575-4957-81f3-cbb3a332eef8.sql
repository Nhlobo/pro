-- Disable the problematic appointment confirmation email trigger
-- This trigger was trying to use net.http_post with null URL from app.settings
-- Email notifications will be handled in the application layer instead
DROP TRIGGER IF EXISTS trigger_send_appointment_confirmation ON appointments;

-- Optionally keep the function in case it's needed later, but it won't be triggered
-- If you want to completely remove it:
-- DROP FUNCTION IF EXISTS send_appointment_confirmation_email() CASCADE;
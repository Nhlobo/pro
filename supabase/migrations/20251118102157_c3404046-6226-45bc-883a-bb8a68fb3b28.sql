-- Drop the problematic trigger and function that's causing the http_request_queue error
DROP TRIGGER IF EXISTS auto_generate_aod_trigger ON appointments;
DROP FUNCTION IF EXISTS trigger_auto_generate_aod() CASCADE;

-- Remove the app.settings dependency that was causing null URL errors
-- The AOD generation will now be handled directly in the application code
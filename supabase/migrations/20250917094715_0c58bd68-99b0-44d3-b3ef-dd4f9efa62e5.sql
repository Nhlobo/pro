-- Create sequence for claimants auto_id if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS claimants_auto_id_seq;

-- Run the sync function to process any existing approved/proposed requests
SELECT sync_existing_appointment_requests();
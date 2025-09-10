-- Add new status option for appointment requests
ALTER TABLE appointment_requests 
DROP CONSTRAINT IF EXISTS appointment_requests_status_check;

ALTER TABLE appointment_requests 
ADD CONSTRAINT appointment_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'new_date_proposed'));

-- Update any existing check constraints to include the new status
COMMENT ON COLUMN appointment_requests.status IS 'Status of the appointment request: pending, approved, rejected, or new_date_proposed';

-- Ensure proper indexing for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status_created 
ON appointment_requests(status, created_at DESC);
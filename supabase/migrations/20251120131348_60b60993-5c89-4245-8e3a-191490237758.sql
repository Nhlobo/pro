-- Enable realtime for appointments table
ALTER TABLE appointments REPLICA IDENTITY FULL;

-- Add appointments to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  END IF;
END $$;

-- Enable realtime for appointment_requests table
ALTER TABLE appointment_requests REPLICA IDENTITY FULL;

-- Add appointment_requests to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'appointment_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointment_requests;
  END IF;
END $$;

-- Enable realtime for expert_reports table
ALTER TABLE expert_reports REPLICA IDENTITY FULL;

-- Add expert_reports to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'expert_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expert_reports;
  END IF;
END $$;
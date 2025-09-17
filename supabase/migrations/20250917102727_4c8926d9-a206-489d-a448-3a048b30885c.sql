-- Enable realtime for appointment_requests table
ALTER TABLE appointment_requests REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_requests;
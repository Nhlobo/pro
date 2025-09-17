-- First, let me check the current appointment_requests table structure to see what fields are available
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'appointment_requests' 
ORDER BY ordinal_position;

-- Also check the appointments table structure 
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;
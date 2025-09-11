-- Add attorney_email column to appointment_requests table
ALTER TABLE public.appointment_requests 
ADD COLUMN attorney_email text;
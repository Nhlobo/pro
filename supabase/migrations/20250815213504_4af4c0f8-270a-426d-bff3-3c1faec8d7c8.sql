-- Add payment_date column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE;
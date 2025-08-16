-- Add matter_type column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN matter_type text;

-- Add check constraint for matter type values
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_matter_type_check 
CHECK (matter_type IN ('MVA', 'Medical Negligence', 'Assault Matter', 'Slip and Fall Matter'));
-- Make attorney_id nullable in short_term_agreements table to allow agreements without attorney assignment
ALTER TABLE public.short_term_agreements 
ALTER COLUMN attorney_id DROP NOT NULL;

-- Add comment explaining the optional nature of attorney_id
COMMENT ON COLUMN public.short_term_agreements.attorney_id IS 'Optional attorney reference. Can be assigned later during appointment sync. References attorneys table when provided.';
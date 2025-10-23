-- Make attorney_id nullable in aod_documents table to allow documents without attorney assignment
ALTER TABLE public.aod_documents 
ALTER COLUMN attorney_id DROP NOT NULL;

-- Add comment explaining the optional nature of attorney_id
COMMENT ON COLUMN public.aod_documents.attorney_id IS 'Optional attorney reference. Can be assigned later during appointment sync. References attorneys table when provided.';
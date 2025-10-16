-- Add contract_description column to aod_documents table
ALTER TABLE public.aod_documents
ADD COLUMN contract_description text;

COMMENT ON COLUMN public.aod_documents.contract_description IS 'Description of the AOD contract terms and conditions';
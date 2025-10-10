-- Add total contract value and payments tracking to aod_documents
ALTER TABLE public.aod_documents 
ADD COLUMN total_contract_value numeric,
ADD COLUMN payments_made integer DEFAULT 0;

-- Add index for better query performance
CREATE INDEX idx_aod_documents_total_value ON public.aod_documents(total_contract_value);

-- Add comment for documentation
COMMENT ON COLUMN public.aod_documents.total_contract_value IS 'Total value of the AOD contract';
COMMENT ON COLUMN public.aod_documents.payments_made IS 'Number of payments made against the contract';
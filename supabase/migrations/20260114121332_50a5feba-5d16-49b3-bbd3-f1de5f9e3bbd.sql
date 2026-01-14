-- Add discount_rate column to aod_documents table
ALTER TABLE public.aod_documents 
ADD COLUMN IF NOT EXISTS discount_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_contract_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_reason text;

-- Add comment for documentation
COMMENT ON COLUMN public.aod_documents.discount_rate IS 'Discount percentage applied to the contract (0-100)';
COMMENT ON COLUMN public.aod_documents.discount_amount IS 'Calculated discount amount based on rate';
COMMENT ON COLUMN public.aod_documents.original_contract_value IS 'Original value before discount applied';
COMMENT ON COLUMN public.aod_documents.discount_reason IS 'Reason for applying the discount';
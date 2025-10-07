-- Add contract dates and enhance payment structure to aod_documents table
ALTER TABLE public.aod_documents 
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Update payment_due_date to be more flexible (keep existing column but we'll use payment_plan_structure for the frequency)
COMMENT ON COLUMN public.aod_documents.payment_plan_structure IS 'Payment frequency: Monthly, 6 Months, Quarterly, 12 Months, etc.';
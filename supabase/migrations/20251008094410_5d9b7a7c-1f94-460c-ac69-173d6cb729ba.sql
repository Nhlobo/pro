-- Add deposit_amount column to aod_documents table
ALTER TABLE public.aod_documents
ADD COLUMN deposit_amount numeric;

COMMENT ON COLUMN public.aod_documents.deposit_amount IS 'Down payment or deposit amount made when entering into agreement';

-- Change payment_due_date to text to store period options
ALTER TABLE public.aod_documents
ALTER COLUMN payment_due_date TYPE text;

COMMENT ON COLUMN public.aod_documents.payment_due_date IS 'Payment due period: 30 days, 60 days, 90 days, Quarterly, 6 months, 12 months, 18 months, or 24 months';
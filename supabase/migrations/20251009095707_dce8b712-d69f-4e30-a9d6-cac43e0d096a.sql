-- Add payment tracking fields to aod_documents table
ALTER TABLE aod_documents
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'upcoming')),
ADD COLUMN IF NOT EXISTS last_payment_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_payment_date timestamp with time zone;

-- Add index for payment monitoring queries
CREATE INDEX IF NOT EXISTS idx_aod_documents_next_payment ON aod_documents(next_payment_date) WHERE payment_status IN ('pending', 'upcoming');
CREATE INDEX IF NOT EXISTS idx_aod_documents_payment_status ON aod_documents(payment_status);
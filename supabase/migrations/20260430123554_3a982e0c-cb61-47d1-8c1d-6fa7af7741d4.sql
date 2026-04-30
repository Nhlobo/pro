-- Add discount tracking to appointments so the form value persists per-appointment
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'amount';

-- Add discount tracking to short_term_agreements (AOD already has these columns)
ALTER TABLE public.short_term_agreements
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;
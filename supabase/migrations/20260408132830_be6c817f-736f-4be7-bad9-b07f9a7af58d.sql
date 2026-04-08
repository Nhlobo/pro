
-- Create payment_report_allocations table
CREATE TABLE public.payment_report_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('aod', 'short_term')),
  claimant_id UUID NOT NULL REFERENCES public.claimants(id) ON DELETE CASCADE,
  claimant_name TEXT NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  referring_attorney_id UUID NOT NULL REFERENCES public.referring_attorneys(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_report_allocations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view payment allocations"
  ON public.payment_report_allocations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert payment allocations"
  ON public.payment_report_allocations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payment allocations"
  ON public.payment_report_allocations FOR DELETE TO authenticated USING (true);

-- Index for fast lookups
CREATE INDEX idx_payment_allocations_payment ON public.payment_report_allocations(payment_id, payment_type);
CREATE INDEX idx_payment_allocations_attorney ON public.payment_report_allocations(referring_attorney_id);

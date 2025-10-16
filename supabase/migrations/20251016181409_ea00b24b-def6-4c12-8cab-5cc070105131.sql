-- Create AOD payments table
CREATE TABLE IF NOT EXISTS public.aod_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aod_document_id UUID NOT NULL REFERENCES public.aod_documents(id) ON DELETE CASCADE,
  payment_amount NUMERIC NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'regular', 'final')),
  payment_date DATE NOT NULL,
  reports_taken_out INTEGER DEFAULT 0,
  payment_notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aod_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view payments from their law firm"
  ON public.aod_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.aod_documents
      WHERE aod_documents.id = aod_payments.aod_document_id
      AND aod_documents.law_firm_id = get_current_user_law_firm()
    )
  );

CREATE POLICY "Users can create payments for their law firm"
  ON public.aod_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.aod_documents
      WHERE aod_documents.id = aod_payments.aod_document_id
      AND aod_documents.law_firm_id = get_current_user_law_firm()
    )
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Users can update payments from their law firm"
  ON public.aod_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.aod_documents
      WHERE aod_documents.id = aod_payments.aod_document_id
      AND aod_documents.law_firm_id = get_current_user_law_firm()
    )
  );

CREATE POLICY "Main admin full access to AOD payments"
  ON public.aod_payments
  FOR ALL
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Create index for better query performance
CREATE INDEX idx_aod_payments_document_id ON public.aod_payments(aod_document_id);
CREATE INDEX idx_aod_payments_payment_date ON public.aod_payments(payment_date DESC);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_aod_payments_updated_at
  BEFORE UPDATE ON public.aod_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
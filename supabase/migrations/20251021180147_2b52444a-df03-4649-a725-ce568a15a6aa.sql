-- Create short_term_agreements table for agreements concluded via email/phone
CREATE TABLE public.short_term_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id uuid NOT NULL,
  law_firm_id uuid NOT NULL,
  created_by uuid NOT NULL,
  
  -- Agreement details
  agreement_method text NOT NULL CHECK (agreement_method IN ('email', 'telephone', 'both')),
  agreement_reference text,
  contract_description text,
  contract_start_date date NOT NULL,
  contract_end_date date NOT NULL,
  
  -- Validation: Max 12 months duration
  CONSTRAINT max_12_months CHECK (
    contract_end_date <= contract_start_date + INTERVAL '12 months'
  ),
  
  -- Payment terms
  total_contract_value numeric(10,2),
  deposit_amount numeric(10,2) DEFAULT 0,
  payment_plan_structure text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
  
  -- Interest rates (same as AOD)
  interest_rate_1_3_months numeric(5,2),
  interest_rate_6_months numeric(5,2),
  interest_rate_12_months numeric(5,2),
  
  -- Payment tracking
  total_reports_agreed integer DEFAULT 0,
  reports_completed integer DEFAULT 0,
  payments_made integer DEFAULT 0,
  next_payment_date timestamp with time zone,
  last_payment_date timestamp with time zone,
  
  -- Additional info
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_short_term_agreements_attorney ON public.short_term_agreements(attorney_id);
CREATE INDEX idx_short_term_agreements_law_firm ON public.short_term_agreements(law_firm_id);
CREATE INDEX idx_short_term_agreements_status ON public.short_term_agreements(status);
CREATE INDEX idx_short_term_agreements_dates ON public.short_term_agreements(contract_start_date, contract_end_date);

-- Enable RLS
ALTER TABLE public.short_term_agreements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Main admin full access to short term agreements"
  ON public.short_term_agreements
  FOR ALL
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

CREATE POLICY "Users can view agreements from their law firm"
  ON public.short_term_agreements
  FOR SELECT
  USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create agreements for their law firm"
  ON public.short_term_agreements
  FOR INSERT
  WITH CHECK (
    law_firm_id = get_current_user_law_firm() 
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update agreements from their law firm"
  ON public.short_term_agreements
  FOR UPDATE
  USING (law_firm_id = get_current_user_law_firm())
  WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete agreements from their law firm"
  ON public.short_term_agreements
  FOR DELETE
  USING (law_firm_id = get_current_user_law_firm());

-- Create payments table for short-term agreements
CREATE TABLE public.short_term_agreement_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.short_term_agreements(id) ON DELETE CASCADE,
  
  payment_date date NOT NULL,
  payment_amount numeric(10,2) NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('deposit', 'installment', 'final', 'other')),
  reports_taken_out integer DEFAULT 0,
  payment_notes text,
  
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on payments
ALTER TABLE public.short_term_agreement_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Main admin full access to agreement payments"
  ON public.short_term_agreement_payments
  FOR ALL
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

CREATE POLICY "Users can view payments from their law firm"
  ON public.short_term_agreement_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.short_term_agreements
      WHERE id = agreement_id
      AND law_firm_id = get_current_user_law_firm()
    )
  );

CREATE POLICY "Users can create payments for their law firm"
  ON public.short_term_agreement_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.short_term_agreements
      WHERE id = agreement_id
      AND law_firm_id = get_current_user_law_firm()
    )
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Users can update payments from their law firm"
  ON public.short_term_agreement_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.short_term_agreements
      WHERE id = agreement_id
      AND law_firm_id = get_current_user_law_firm()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_short_term_agreements_updated_at
  BEFORE UPDATE ON public.short_term_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_short_term_agreement_payments_updated_at
  BEFORE UPDATE ON public.short_term_agreement_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
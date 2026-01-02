-- Add signature and status tracking fields to aod_documents
ALTER TABLE public.aod_documents
ADD COLUMN IF NOT EXISTS agreement_type text DEFAULT 'long-term',
ADD COLUMN IF NOT EXISTS agreement_duration_term text,
ADD COLUMN IF NOT EXISTS debtor_law_firm_name text,
ADD COLUMN IF NOT EXISTS debtor_registration_number text,
ADD COLUMN IF NOT EXISTS debtor_authorized_rep text,
ADD COLUMN IF NOT EXISTS debtor_domicilium_address text,
ADD COLUMN IF NOT EXISTS matter_types text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS roll_out_plan_reference text,
ADD COLUMN IF NOT EXISTS total_amount_words text,
ADD COLUMN IF NOT EXISTS payment_frequency text DEFAULT 'quarterly',
ADD COLUMN IF NOT EXISTS grace_period_days integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS document_status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS creditor_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS debtor_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS witness1_name text,
ADD COLUMN IF NOT EXISTS witness1_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS witness2_name text,
ADD COLUMN IF NOT EXISTS witness2_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS signed_document_url text,
ADD COLUMN IF NOT EXISTS is_digitally_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS default_status text,
ADD COLUMN IF NOT EXISTS default_notice_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS default_notice_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS services_suspended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS legal_escalation_notes text,
ADD COLUMN IF NOT EXISTS reports_released integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_triggered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trigger_reason text;

-- Add same fields to short_term_agreements
ALTER TABLE public.short_term_agreements
ADD COLUMN IF NOT EXISTS debtor_law_firm_name text,
ADD COLUMN IF NOT EXISTS debtor_registration_number text,
ADD COLUMN IF NOT EXISTS debtor_authorized_rep text,
ADD COLUMN IF NOT EXISTS debtor_domicilium_address text,
ADD COLUMN IF NOT EXISTS matter_types text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS roll_out_plan_reference text,
ADD COLUMN IF NOT EXISTS total_amount_words text,
ADD COLUMN IF NOT EXISTS payment_frequency text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS grace_period_days integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS document_status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS creditor_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS debtor_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS witness1_name text,
ADD COLUMN IF NOT EXISTS witness1_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS witness2_name text,
ADD COLUMN IF NOT EXISTS witness2_signature_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS signed_document_url text,
ADD COLUMN IF NOT EXISTS is_digitally_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS default_status text,
ADD COLUMN IF NOT EXISTS default_notice_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS default_notice_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS services_suspended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS legal_escalation_notes text,
ADD COLUMN IF NOT EXISTS reports_released integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_triggered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trigger_reason text;

-- Create annexure table for payment & report release schedule
CREATE TABLE IF NOT EXISTS public.agreement_annexures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id uuid NOT NULL,
  agreement_type text NOT NULL CHECK (agreement_type IN ('aod', 'short_term')),
  phase_name text NOT NULL,
  phase_order integer NOT NULL,
  payment_stage text NOT NULL,
  payment_percentage numeric,
  payment_amount numeric,
  deliverables text[] DEFAULT '{}',
  is_paid boolean DEFAULT false,
  paid_at timestamp with time zone,
  deliverables_released boolean DEFAULT false,
  released_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on annexures table
ALTER TABLE public.agreement_annexures ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for annexures
CREATE POLICY "System admins full access to annexures"
ON public.agreement_annexures
FOR ALL
USING (is_system_admin())
WITH CHECK (is_system_admin());

CREATE POLICY "Users can view annexures for their agreements"
ON public.agreement_annexures
FOR SELECT
USING (
  (agreement_type = 'aod' AND EXISTS (
    SELECT 1 FROM aod_documents 
    WHERE id = agreement_annexures.agreement_id 
    AND referring_attorney_id = get_current_user_referring_attorney()
  ))
  OR
  (agreement_type = 'short_term' AND EXISTS (
    SELECT 1 FROM short_term_agreements 
    WHERE id = agreement_annexures.agreement_id 
    AND referring_attorney_id = get_current_user_referring_attorney()
  ))
);

CREATE POLICY "Users can manage annexures for their agreements"
ON public.agreement_annexures
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role)
);

-- Create default flags and payment monitoring view
CREATE OR REPLACE VIEW public.agreement_payment_status AS
SELECT 
  id,
  'aod' as agreement_type,
  referring_attorney_id,
  total_contract_value,
  deposit_amount,
  payment_status,
  document_status,
  default_status,
  services_suspended,
  next_payment_date,
  last_payment_date,
  reports_released,
  total_reports_agreed,
  created_at
FROM public.aod_documents
UNION ALL
SELECT 
  id,
  'short_term' as agreement_type,
  referring_attorney_id,
  total_contract_value,
  deposit_amount,
  payment_status,
  document_status,
  default_status,
  services_suspended,
  next_payment_date,
  last_payment_date,
  reports_released,
  total_reports_agreed,
  created_at
FROM public.short_term_agreements;

-- Create trigger function for default detection
CREATE OR REPLACE FUNCTION public.check_agreement_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if payment is overdue
  IF NEW.next_payment_date IS NOT NULL AND NEW.next_payment_date < NOW() AND NEW.payment_status != 'paid' THEN
    IF NEW.default_status IS NULL OR NEW.default_status = '' THEN
      NEW.default_status := 'overdue';
    END IF;
    
    -- Check if grace period has passed
    IF NEW.next_payment_date + (COALESCE(NEW.grace_period_days, 7) || ' days')::interval < NOW() THEN
      NEW.default_status := 'in_default';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for both tables
DROP TRIGGER IF EXISTS check_aod_default ON public.aod_documents;
CREATE TRIGGER check_aod_default
BEFORE UPDATE ON public.aod_documents
FOR EACH ROW
EXECUTE FUNCTION public.check_agreement_default();

DROP TRIGGER IF EXISTS check_short_term_default ON public.short_term_agreements;
CREATE TRIGGER check_short_term_default
BEFORE UPDATE ON public.short_term_agreements
FOR EACH ROW
EXECUTE FUNCTION public.check_agreement_default();
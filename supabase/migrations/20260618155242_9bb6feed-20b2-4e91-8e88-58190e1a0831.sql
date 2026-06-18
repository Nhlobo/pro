
-- 1. Unified POP attachments table
CREATE TABLE public.payment_pop_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL CHECK (record_type IN ('appointment_request','aod_payment','expert_payment')),
  record_id uuid NOT NULL,
  payment_reference text NOT NULL,
  sageone_transaction_id text,
  file_path text NOT NULL,
  file_name text,
  file_size_bytes integer,
  mime_type text,
  notes text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pop_attachments_record ON public.payment_pop_attachments(record_type, record_id);
CREATE INDEX idx_pop_attachments_reference ON public.payment_pop_attachments(payment_reference);
CREATE INDEX idx_pop_attachments_sageone ON public.payment_pop_attachments(sageone_transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_pop_attachments TO authenticated;
GRANT ALL ON public.payment_pop_attachments TO service_role;

ALTER TABLE public.payment_pop_attachments ENABLE ROW LEVEL SECURITY;

-- Admins/managers can do anything
CREATE POLICY "Admins manage all POPs"
ON public.payment_pop_attachments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own uploads
CREATE POLICY "Users read own POPs"
ON public.payment_pop_attachments
FOR SELECT
TO authenticated
USING (uploaded_by = auth.uid());

-- Users can insert POPs they own
CREATE POLICY "Users insert own POPs"
ON public.payment_pop_attachments
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Users can update notes/reference on their own uploads (but not sageone_transaction_id; enforced via trigger)
CREATE POLICY "Users update own POPs"
ON public.payment_pop_attachments
FOR UPDATE
TO authenticated
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

-- Trigger: block non-admins from changing sageone_transaction_id
CREATE OR REPLACE FUNCTION public.protect_sageone_field()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.sageone_transaction_id IS DISTINCT FROM OLD.sageone_transaction_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can modify SageOne transaction ID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_sageone
BEFORE UPDATE ON public.payment_pop_attachments
FOR EACH ROW EXECUTE FUNCTION public.protect_sageone_field();

-- Auto-generate payment_reference when blank
CREATE OR REPLACE FUNCTION public.autogen_payment_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_reference IS NULL OR length(trim(NEW.payment_reference)) = 0 THEN
    NEW.payment_reference := 'PAY-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMM') || '-' || upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_autogen_pop_reference
BEFORE INSERT ON public.payment_pop_attachments
FOR EACH ROW EXECUTE FUNCTION public.autogen_payment_reference();

-- updated_at trigger
CREATE TRIGGER trg_pop_updated_at
BEFORE UPDATE ON public.payment_pop_attachments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Extend parent tables
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS pop_attachment_id uuid REFERENCES public.payment_pop_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sageone_transaction_id text;

ALTER TABLE public.aod_payments
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS pop_attachment_id uuid REFERENCES public.payment_pop_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sageone_transaction_id text;

ALTER TABLE public.expert_payments
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS pop_attachment_id uuid REFERENCES public.payment_pop_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sageone_transaction_id text;

-- 3. System setting toggle (default false = POP optional)
INSERT INTO public.system_settings (setting_key, setting_value, category, description)
VALUES (
  'pop_required_on_submission',
  'false'::jsonb,
  'payments',
  'When true, attorney requests and payment records require a POP attachment before submission.'
)
ON CONFLICT (setting_key) DO NOTHING;

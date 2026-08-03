CREATE TABLE IF NOT EXISTS public.sageone_invoice_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  sageone_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT sageone_invoice_queue_status_check CHECK (status IN ('pending', 'processing', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sageone_invoice_queue_status_created_at
  ON public.sageone_invoice_queue (status, created_at);

CREATE INDEX IF NOT EXISTS idx_sageone_invoice_queue_appointment_id
  ON public.sageone_invoice_queue (appointment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sageone_invoice_queue_active_appointment
  ON public.sageone_invoice_queue (appointment_id)
  WHERE status IN ('pending', 'processing', 'success');

ALTER TABLE public.sageone_invoice_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_sageone_invoice_on_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_data JSONB := to_jsonb(NEW);
  invoice_amount NUMERIC := COALESCE(NEW.service_fee, NEW.deposit_amount, 0);
BEGIN
  IF COALESCE(NEW.service_fee, 0) > 0 OR COALESCE(NEW.deposit_amount, 0) > 0 THEN
    INSERT INTO public.sageone_invoice_queue (appointment_id, payload, status)
    SELECT
      NEW.id,
      jsonb_build_object(
        'appointment_id', NEW.id,
        'appointment_date', NEW.appointment_date,
        'referring_attorney_id', NEW.referring_attorney_id,
        'claimant_id', NEW.claimant_id,
        'expert_id', NEW.expert_id,
        'amount', invoice_amount,
        'currency', COALESCE(NULLIF(appointment_data ->> 'currency', ''), 'ZAR'),
        'notes', COALESCE(NULLIF(appointment_data ->> 'notes', ''), NULLIF(appointment_data ->> 'matter_type', '')),
        'payment_terms', NEW.payment_terms,
        'appointment_reference', NEW.id
      ),
      'pending'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.sageone_invoice_queue existing
      WHERE existing.appointment_id = NEW.id
        AND existing.status <> 'failed'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_sageone_invoice ON public.appointments;

CREATE TRIGGER trigger_enqueue_sageone_invoice
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_sageone_invoice_on_appointment();

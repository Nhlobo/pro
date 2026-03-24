
-- Expert access codes table (mirrors attorney_access_codes pattern)
CREATE TABLE public.expert_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code TEXT NOT NULL UNIQUE,
  expert_id UUID NOT NULL REFERENCES public.medical_experts(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_expert_access_codes_code ON public.expert_access_codes(access_code);
CREATE INDEX idx_expert_access_codes_expert ON public.expert_access_codes(expert_id);

-- RLS
ALTER TABLE public.expert_access_codes ENABLE ROW LEVEL SECURITY;

-- Admin/employee full access
CREATE POLICY "Admin and employee full access on expert_access_codes"
ON public.expert_access_codes
FOR ALL
TO authenticated
USING (public.is_system_admin());

-- DB function to generate expert access code
CREATE OR REPLACE FUNCTION public.generate_expert_access_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  i INTEGER;
BEGIN
  LOOP
    new_code := '';
    FOR i IN 1..12 LOOP
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM expert_access_codes WHERE access_code = new_code);
  END LOOP;
  RETURN new_code;
END;
$$;

-- Auto-deactivate expert codes when case is closed (report completed + paid)
CREATE OR REPLACE FUNCTION public.check_expert_code_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When appointment payment_status changes to 'Paid', check if report is also done
  IF NEW.payment_status = 'Paid' THEN
    -- Check if expert report is completed
    IF EXISTS (
      SELECT 1 FROM expert_reports 
      WHERE appointment_id = NEW.id 
      AND report_status IN ('completed', 'taken_out', 'taken out')
    ) THEN
      UPDATE expert_access_codes 
      SET is_active = false, 
          deactivated_at = now(), 
          deactivation_reason = 'Matter closed - report delivered and payment received'
      WHERE appointment_id = NEW.id AND is_active = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_expert_code_on_payment
AFTER UPDATE OF payment_status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_expert_code_expiry();

-- Also check when expert report status changes
CREATE OR REPLACE FUNCTION public.check_expert_code_on_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.report_status IN ('completed', 'taken_out', 'taken out') THEN
    -- Check if appointment is also paid
    IF EXISTS (
      SELECT 1 FROM appointments 
      WHERE id = NEW.appointment_id 
      AND payment_status = 'Paid'
    ) THEN
      UPDATE expert_access_codes 
      SET is_active = false, 
          deactivated_at = now(), 
          deactivation_reason = 'Matter closed - report delivered and payment received'
      WHERE appointment_id = NEW.appointment_id AND is_active = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_expert_code_on_report
AFTER UPDATE OF report_status ON public.expert_reports
FOR EACH ROW
EXECUTE FUNCTION public.check_expert_code_on_report();

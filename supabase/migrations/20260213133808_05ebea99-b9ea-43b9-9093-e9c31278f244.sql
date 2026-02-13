
-- Create a function to auto-expire access codes when case is paid in full and report is submitted
CREATE OR REPLACE FUNCTION public.check_and_expire_access_codes()
RETURNS TRIGGER AS $$
DECLARE
  apt_payment_status TEXT;
  apt_report_status TEXT;
  apt_id TEXT;
BEGIN
  -- This trigger fires on appointments table updates
  apt_id := NEW.id;
  apt_payment_status := NEW.payment_status;

  -- Check if payment is 'paid' (paid in full)
  IF apt_payment_status = 'paid' THEN
    -- Check if there's a completed report for this appointment
    IF EXISTS (
      SELECT 1 FROM public.expert_reports
      WHERE appointment_id = apt_id
      AND (report_status = 'completed' OR report_status = 'taken_out')
    ) THEN
      -- Expire all active access codes for this appointment
      UPDATE public.attorney_access_codes
      SET is_active = false,
          deactivated_at = now(),
          deactivation_reason = 'Case paid in full and report submitted'
      WHERE appointment_id = apt_id
      AND is_active = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on appointments table for payment status changes
DROP TRIGGER IF EXISTS trigger_expire_access_codes_on_payment ON public.appointments;
CREATE TRIGGER trigger_expire_access_codes_on_payment
  AFTER UPDATE OF payment_status ON public.appointments
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid')
  EXECUTE FUNCTION public.check_and_expire_access_codes();

-- Also create a function to expire access codes when report status changes
CREATE OR REPLACE FUNCTION public.check_and_expire_access_codes_on_report()
RETURNS TRIGGER AS $$
DECLARE
  apt_payment_status TEXT;
BEGIN
  -- Check if the report is now completed/taken_out
  IF NEW.report_status IN ('completed', 'taken_out') AND NEW.appointment_id IS NOT NULL THEN
    -- Check if the appointment is paid in full
    SELECT payment_status INTO apt_payment_status
    FROM public.appointments
    WHERE id = NEW.appointment_id;

    IF apt_payment_status = 'paid' THEN
      -- Expire all active access codes for this appointment
      UPDATE public.attorney_access_codes
      SET is_active = false,
          deactivated_at = now(),
          deactivation_reason = 'Case paid in full and report submitted'
      WHERE appointment_id = NEW.appointment_id
      AND is_active = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on expert_reports table for report status changes
DROP TRIGGER IF EXISTS trigger_expire_access_codes_on_report ON public.expert_reports;
CREATE TRIGGER trigger_expire_access_codes_on_report
  AFTER UPDATE OF report_status ON public.expert_reports
  FOR EACH ROW
  WHEN (NEW.report_status IN ('completed', 'taken_out'))
  EXECUTE FUNCTION public.check_and_expire_access_codes_on_report();

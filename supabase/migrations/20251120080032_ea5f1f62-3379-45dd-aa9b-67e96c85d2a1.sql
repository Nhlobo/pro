-- Create table to track grouped email sends
CREATE TABLE IF NOT EXISTS public.grouped_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referring_attorney_id UUID NOT NULL REFERENCES referring_attorneys(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_ids UUID[] NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  email_sent_to TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(referring_attorney_id, appointment_date, sent_at)
);

-- Enable RLS
ALTER TABLE public.grouped_email_log ENABLE ROW LEVEL SECURITY;

-- System admins full access
CREATE POLICY "System admins full access to grouped email log"
  ON public.grouped_email_log
  FOR ALL
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Users can view logs for their referring attorney
CREATE POLICY "Users can view grouped email logs from their referring attorney"
  ON public.grouped_email_log
  FOR SELECT
  USING (referring_attorney_id = get_current_user_referring_attorney());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_grouped_email_log_attorney_date 
  ON public.grouped_email_log(referring_attorney_id, appointment_date);

-- Create function to trigger email sending after appointment changes
CREATE OR REPLACE FUNCTION public.trigger_appointment_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_service_url TEXT;
  v_anon_key TEXT;
BEGIN
  -- Only trigger for appointments with confirmed dates that aren't deleted
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.appointment_date IS DISTINCT FROM NEW.appointment_date))
     AND NEW.appointment_date IS NOT NULL 
     AND NEW.deleted_at IS NULL THEN
    
    -- Get Supabase project URL and anon key from environment
    v_service_url := current_setting('app.settings.service_url', true);
    v_anon_key := current_setting('app.settings.anon_key', true);
    
    -- Call the edge function asynchronously using pg_net if available
    -- For now, we'll use a simpler approach with NOTIFY
    PERFORM pg_notify(
      'appointment_confirmation_needed',
      json_build_object(
        'appointment_id', NEW.id,
        'referring_attorney_id', NEW.referring_attorney_id,
        'appointment_date', NEW.appointment_date
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on appointments table
DROP TRIGGER IF EXISTS trigger_send_appointment_confirmation ON public.appointments;
CREATE TRIGGER trigger_send_appointment_confirmation
  AFTER INSERT OR UPDATE OF appointment_date
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_confirmation_email();
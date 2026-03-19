
-- 1. Notify admins when a new appointment request is submitted
CREATE OR REPLACE FUNCTION public.notify_admin_new_appointment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
BEGIN
  FOR admin_user IN 
    SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
    VALUES (
      admin_user.user_id,
      '📋 New Booking Request',
      'New appointment request from ' || COALESCE(NEW.claimant_first_name, '') || ' ' || COALESCE(NEW.claimant_last_name, '') || ' (' || COALESCE(NEW.expert_type_requested, 'N/A') || ' - ' || COALESCE(NEW.province, 'N/A') || ').',
      'info',
      'appointment_request',
      NEW.id,
      'appointment_requests'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_appointment_request_notify ON public.appointment_requests;
CREATE TRIGGER on_new_appointment_request_notify
  AFTER INSERT ON public.appointment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_appointment_request();

-- 2. Notify admins when a new referring attorney is captured
CREATE OR REPLACE FUNCTION public.notify_admin_new_attorney()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
BEGIN
  FOR admin_user IN 
    SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
    VALUES (
      admin_user.user_id,
      '🏛️ New Attorney Captured',
      'New referring attorney added: ' || COALESCE(NEW.name, 'Unknown') || COALESCE(' (' || NEW.province || ')', '') || '.',
      'success',
      'attorney',
      NEW.id,
      'referring_attorneys'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_attorney_notify ON public.referring_attorneys;
CREATE TRIGGER on_new_attorney_notify
  AFTER INSERT ON public.referring_attorneys
  FOR EACH ROW
  WHEN (NEW.is_system_company IS NOT TRUE)
  EXECUTE FUNCTION public.notify_admin_new_attorney();

-- 3. Notify admins when a new scheduled appointment is created (shows count-style message)
CREATE OR REPLACE FUNCTION public.notify_admin_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
  today_count INTEGER;
BEGIN
  -- Count total appointments made today
  SELECT COUNT(*) INTO today_count
  FROM public.appointments
  WHERE DATE(created_at) = CURRENT_DATE
    AND deleted_at IS NULL;

  FOR admin_user IN 
    SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
    VALUES (
      admin_user.user_id,
      '📅 New Appointment Made',
      today_count || ' new Appointment(s) Made today. Latest: ' || COALESCE(NEW.referring_attorney, 'N/A') || '.',
      'info',
      'appointment',
      NEW.id,
      'appointments'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_appointment_notify ON public.appointments;
CREATE TRIGGER on_new_appointment_notify
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_appointment();

-- 4. Notify admins when a report is received (status changes to completed/taken_out)
CREATE OR REPLACE FUNCTION public.notify_admin_report_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
  v_claimant_name TEXT;
  v_expert_name TEXT;
BEGIN
  -- Only fire when report_status changes to completed or taken_out
  IF (OLD.report_status IS DISTINCT FROM NEW.report_status) 
     AND NEW.report_status IN ('completed', 'taken_out') THEN

    -- Get claimant name
    SELECT c.first_name || ' ' || c.last_name INTO v_claimant_name
    FROM public.appointments a
    JOIN public.claimants c ON a.claimant_id = c.id
    WHERE a.id = NEW.appointment_id;

    -- Get expert name
    SELECT me.first_name || ' ' || me.last_name INTO v_expert_name
    FROM public.medical_experts me
    WHERE me.id = NEW.expert_id;

    FOR admin_user IN 
      SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
      VALUES (
        admin_user.user_id,
        '📄 Report Received',
        'Report for ' || COALESCE(v_claimant_name, 'Unknown Claimant') || ' from ' || COALESCE(v_expert_name, 'Unknown Expert') || ' has been received.',
        'success',
        'report',
        NEW.id,
        'expert_reports'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_report_received_notify ON public.expert_reports;
CREATE TRIGGER on_report_received_notify
  AFTER UPDATE ON public.expert_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_report_received();

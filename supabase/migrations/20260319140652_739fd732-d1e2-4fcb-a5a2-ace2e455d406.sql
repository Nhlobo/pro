
-- Create a function that notifies admins when a new email is queued
CREATE OR REPLACE FUNCTION public.notify_admin_email_queued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
BEGIN
  FOR admin_user IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
    VALUES (
      admin_user.user_id,
      '📧 New Email Pending Review',
      'A new ' || COALESCE(NEW.email_type, 'system') || ' email to ' || COALESCE(NEW.recipient_name, NEW.recipient_email) || ' requires your review and approval.',
      'warning',
      'email_queue',
      NEW.id,
      'email_queue'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger on email_queue table
DROP TRIGGER IF EXISTS on_email_queued_notify_admin ON public.email_queue;
CREATE TRIGGER on_email_queued_notify_admin
  AFTER INSERT ON public.email_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_admin_email_queued();

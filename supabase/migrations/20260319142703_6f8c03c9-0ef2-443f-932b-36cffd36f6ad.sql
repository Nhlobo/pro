
-- Daily cleanup: delete read notifications from previous days
CREATE OR REPLACE FUNCTION public.cleanup_read_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE is_read = true
    AND read_at IS NOT NULL
    AND read_at::date < CURRENT_DATE;
END;
$$;

-- Schedule daily cleanup at midnight
SELECT cron.schedule(
  'cleanup-read-notifications',
  '0 0 * * *',
  $$SELECT public.cleanup_read_notifications();$$
);

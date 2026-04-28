DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-sales-strike-check') THEN
    PERFORM cron.unschedule('monthly-sales-strike-check');
  END IF;
END $$;

SELECT cron.schedule(
  'monthly-sales-strike-check',
  '0 6 25 * *',
  $$
  SELECT net.http_post(
    url := 'https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1/send-performance-warning',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YmtoaHh2c2Rqa2x1cXlkY2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYzNzgsImV4cCI6MjA3MDUxMjM3OH0.63RLvxgywnkjnqHzr9OLNxB_6wVpOBtcGlQZvJR_HyQ","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YmtoaHh2c2Rqa2x1cXlkY2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYzNzgsImV4cCI6MjA3MDUxMjM3OH0.63RLvxgywnkjnqHzr9OLNxB_6wVpOBtcGlQZvJR_HyQ"}'::jsonb,
    body := jsonb_build_object('scheduled', true, 'time', now())
  ) AS request_id;
  $$
);
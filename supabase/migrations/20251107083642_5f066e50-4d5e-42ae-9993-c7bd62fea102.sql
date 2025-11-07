-- Schedule the 48-hour reminder function to run every hour
-- This will automatically replace any existing job with the same name
SELECT cron.schedule(
  '48hr-appointment-reminders',
  '0 * * * *',  -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
        url:='https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1/send-48hr-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YmtoaHh2c2Rqa2x1cXlkY2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYzNzgsImV4cCI6MjA3MDUxMjM3OH0.63RLvxgywnkjnqHzr9OLNxB_6wVpOBtcGlQZvJR_HyQ"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

ALTER TABLE public.expert_payment_planner_snapshots
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_epp_snapshots_pending_reminder
  ON public.expert_payment_planner_snapshots (approval_status, submitted_for_approval_at)
  WHERE approval_status = 'pending';

-- Schedule 48-hour reminder check every hour
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'remind-pending-payment-approvals-hourly';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'remind-pending-payment-approvals-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1/remind-pending-payment-approvals',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YmtoaHh2c2Rqa2x1cXlkY2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYzNzgsImV4cCI6MjA3MDUxMjM3OH0.63RLvxgywnkjnqHzr9OLNxB_6wVpOBtcGlQZvJR_HyQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

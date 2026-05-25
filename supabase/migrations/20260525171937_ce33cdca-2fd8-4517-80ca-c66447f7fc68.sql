
-- Sales performance reports history table
CREATE TABLE public.sales_performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID REFERENCES public.sales_consultants(id) ON DELETE CASCADE,
  user_id UUID,
  consultant_name TEXT NOT NULL,
  email TEXT,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly','monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  deals_closed INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL DEFAULT 0,
  target_met BOOLEAN NOT NULL DEFAULT false,
  strike_risk_level TEXT NOT NULL DEFAULT 'none' CHECK (strike_risk_level IN ('none','low','medium','high')),
  current_strikes INTEGER NOT NULL DEFAULT 0,
  auto_comment TEXT,
  congratulations TEXT,
  report_html TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spr_consultant_period ON public.sales_performance_reports(consultant_id, period_type, period_start DESC);
CREATE INDEX idx_spr_created_at ON public.sales_performance_reports(created_at DESC);

ALTER TABLE public.sales_performance_reports ENABLE ROW LEVEL SECURITY;

-- Admins/managers can view all
CREATE POLICY "Admins manage performance reports"
ON public.sales_performance_reports
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Consultants can view their own
CREATE POLICY "Consultants view their own reports"
ON public.sales_performance_reports
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Schedule weekly Monday 09:00 SAST (07:00 UTC)
SELECT cron.schedule(
  'weekly-sales-performance-report',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url:='https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1/send-sales-performance-report',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YmtoaHh2c2Rqa2x1cXlkY2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYzNzgsImV4cCI6MjA3MDUxMjM3OH0.63RLvxgywnkjnqHzr9OLNxB_6wVpOBtcGlQZvJR_HyQ"}'::jsonb,
    body:='{"period_type":"weekly"}'::jsonb
  );
  $$
);

-- Schedule monthly: run daily at 18:00 SAST (16:00 UTC); the function checks if today is last day
SELECT cron.schedule(
  'monthly-sales-performance-report',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url:='https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1/send-sales-performance-report',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YmtoaHh2c2Rqa2x1cXlkY2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYzNzgsImV4cCI6MjA3MDUxMjM3OH0.63RLvxgywnkjnqHzr9OLNxB_6wVpOBtcGlQZvJR_HyQ"}'::jsonb,
    body:='{"period_type":"monthly","only_if_month_end":true}'::jsonb
  );
  $$
);

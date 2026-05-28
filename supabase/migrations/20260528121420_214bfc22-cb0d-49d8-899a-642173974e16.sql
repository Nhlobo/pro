
-- 1. Table
CREATE TABLE IF NOT EXISTS public.user_activity_time (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_key TEXT NOT NULL,
  activity_label TEXT NOT NULL,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Johannesburg')::date,
  seconds_spent INTEGER NOT NULL DEFAULT 0 CHECK (seconds_spent >= 0),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_activity_time_unique
  ON public.user_activity_time (user_id, activity_key, day);

CREATE INDEX IF NOT EXISTS user_activity_time_user_day
  ON public.user_activity_time (user_id, day);

-- 2. GRANTs
GRANT SELECT ON public.user_activity_time TO authenticated;
GRANT ALL ON public.user_activity_time TO service_role;

-- 3. RLS
ALTER TABLE public.user_activity_time ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own activity time"
  ON public.user_activity_time FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4. Logging RPC (SECURITY DEFINER upsert)
CREATE OR REPLACE FUNCTION public.log_activity_time(
  _activity_key TEXT,
  _activity_label TEXT,
  _seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _day DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  IF _uid IS NULL OR _seconds IS NULL OR _seconds <= 0 THEN
    RETURN;
  END IF;
  IF _activity_key IS NULL OR length(trim(_activity_key)) = 0 THEN
    RETURN;
  END IF;
  -- Cap a single submission at 1 hour to defend against bad clients
  IF _seconds > 3600 THEN
    _seconds := 3600;
  END IF;

  INSERT INTO public.user_activity_time
    (user_id, activity_key, activity_label, day, seconds_spent, last_updated_at)
  VALUES
    (_uid, _activity_key, COALESCE(_activity_label, _activity_key), _day, _seconds, now())
  ON CONFLICT (user_id, activity_key, day)
  DO UPDATE SET
    seconds_spent = public.user_activity_time.seconds_spent + EXCLUDED.seconds_spent,
    activity_label = EXCLUDED.activity_label,
    last_updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity_time(TEXT, TEXT, INTEGER) TO authenticated;

-- 5. Summary RPC
CREATE OR REPLACE FUNCTION public.get_user_activity_summary(
  _user_id UUID,
  _start DATE,
  _end DATE
)
RETURNS TABLE (
  activity_key TEXT,
  activity_label TEXT,
  total_seconds BIGINT,
  pct_of_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grand BIGINT;
BEGIN
  -- Only the user themselves or an admin may read another user's summary
  IF _user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT COALESCE(SUM(seconds_spent), 0) INTO _grand
  FROM public.user_activity_time
  WHERE user_id = _user_id AND day BETWEEN _start AND _end;

  RETURN QUERY
  SELECT
    a.activity_key,
    a.activity_label,
    SUM(a.seconds_spent)::BIGINT AS total_seconds,
    CASE WHEN _grand > 0
      THEN ROUND((SUM(a.seconds_spent)::NUMERIC / _grand) * 100, 1)
      ELSE 0
    END AS pct_of_total
  FROM public.user_activity_time a
  WHERE a.user_id = _user_id AND a.day BETWEEN _start AND _end
  GROUP BY a.activity_key, a.activity_label
  ORDER BY total_seconds DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_activity_summary(UUID, DATE, DATE) TO authenticated, service_role;

-- 6. Extend sales_performance_reports with report_kind
ALTER TABLE public.sales_performance_reports
  ADD COLUMN IF NOT EXISTS report_kind TEXT NOT NULL DEFAULT 'sales';

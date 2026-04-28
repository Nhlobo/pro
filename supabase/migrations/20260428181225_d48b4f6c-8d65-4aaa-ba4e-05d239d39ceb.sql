CREATE OR REPLACE FUNCTION public.get_consultant_period_stats(p_start DATE, p_end DATE)
RETURNS TABLE (
  consultant_id UUID,
  raf_appts BIGINT,
  medneg_appts BIGINT,
  total_appts BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.sales_consultant_id AS consultant_id,
    COUNT(*) FILTER (WHERE LOWER(COALESCE(a.matter_type, '')) NOT LIKE '%neg%') AS raf_appts,
    COUNT(*) FILTER (WHERE LOWER(COALESCE(a.matter_type, '')) LIKE '%neg%') AS medneg_appts,
    COUNT(*) AS total_appts
  FROM public.appointments a
  WHERE a.deleted_at IS NULL
    AND a.sales_consultant_id IS NOT NULL
    AND COALESCE(a.payment_date::date, a.appointment_date::date) >= p_start
    AND COALESCE(a.payment_date::date, a.appointment_date::date) <= p_end
    AND (
      COALESCE(a.deposit_amount, 0) > 0
      OR COALESCE(a.payment_status, '') IN ('deposit', 'full_payment', 'paid')
    )
  GROUP BY a.sales_consultant_id;
$$;

CREATE OR REPLACE FUNCTION public.get_consultant_monthly_stats(p_month INTEGER, p_year INTEGER)
RETURNS TABLE (
  consultant_id UUID,
  raf_appts BIGINT,
  medneg_appts BIGINT,
  total_appts BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.get_consultant_period_stats(
    make_date(
      CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END,
      CASE WHEN p_month = 1 THEN 12 ELSE p_month - 1 END,
      26
    ),
    make_date(p_year, p_month, 25)
  );
$$;

ALTER TABLE public.consultant_strikes
ADD COLUMN IF NOT EXISTS payout_month INTEGER,
ADD COLUMN IF NOT EXISTS payout_year INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS consultant_strikes_consultant_payout_unique
ON public.consultant_strikes (consultant_id, payout_month, payout_year)
WHERE payout_month IS NOT NULL AND payout_year IS NOT NULL;

CREATE OR REPLACE FUNCTION public.issue_monthly_sales_strikes(p_run_date DATE DEFAULT ((now() AT TIME ZONE 'Africa/Johannesburg')::date))
RETURNS TABLE (
  consultant_id UUID,
  consultant_name TEXT,
  user_id UUID,
  user_email TEXT,
  current_appts INTEGER,
  strike_count INTEGER,
  strike_type TEXT,
  payout_month INTEGER,
  payout_year INTEGER,
  issued BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_month INTEGER := EXTRACT(MONTH FROM p_run_date)::INTEGER;
  v_payout_year INTEGER := EXTRACT(YEAR FROM p_run_date)::INTEGER;
  v_period_start DATE := (date_trunc('month', p_run_date)::date - INTERVAL '1 month')::date + 25;
  v_period_end DATE := date_trunc('month', p_run_date)::date + 24;
  v_target INTEGER := 7;
  v_start_month DATE := DATE '2026-04-01';
BEGIN
  IF EXTRACT(DAY FROM p_run_date)::INTEGER <> 25 OR make_date(v_payout_year, v_payout_month, 1) < v_start_month THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH stats AS (
    SELECT * FROM public.get_consultant_period_stats(v_period_start, v_period_end)
  ), eligible AS (
    SELECT
      sc.id AS consultant_id,
      sc.name AS consultant_name,
      sc.user_id,
      COALESCE(p.email, au.email) AS user_email,
      COALESCE(st.total_appts, 0)::INTEGER AS current_appts,
      COUNT(cs.id) FILTER (WHERE NOT COALESCE(cs.expired, false) AND cs.expiry_date >= p_run_date)::INTEGER AS active_strikes
    FROM public.sales_consultants sc
    LEFT JOIN stats st ON st.consultant_id = sc.id
    LEFT JOIN public.consultant_strikes cs ON cs.consultant_id = sc.id
    LEFT JOIN public.profiles p ON p.id = sc.user_id
    LEFT JOIN auth.users au ON au.id = sc.user_id
    WHERE sc.is_active = true
    GROUP BY sc.id, sc.name, sc.user_id, p.email, au.email, st.total_appts
  ), to_issue AS (
    SELECT
      e.*,
      LEAST(e.active_strikes + 1, 3)::INTEGER AS next_count,
      CASE
        WHEN e.active_strikes = 0 THEN 'verbal'
        WHEN e.active_strikes = 1 THEN 'written'
        ELSE 'dismissal'
      END AS next_type
    FROM eligible e
    WHERE e.current_appts < v_target
      AND NOT EXISTS (
        SELECT 1
        FROM public.consultant_strikes existing
        WHERE existing.consultant_id = e.consultant_id
          AND existing.payout_month = v_payout_month
          AND existing.payout_year = v_payout_year
      )
  ), inserted AS (
    INSERT INTO public.consultant_strikes (
      consultant_id,
      issued_date,
      expiry_date,
      type,
      reason,
      payout_month,
      payout_year
    )
    SELECT
      ti.consultant_id,
      p_run_date,
      (p_run_date + INTERVAL '120 days')::date,
      ti.next_type,
      format('Below monthly target: %s/%s qualifying deals for payout period %s to %s.', ti.current_appts, v_target, v_period_start, v_period_end),
      v_payout_month,
      v_payout_year
    FROM to_issue ti
    RETURNING consultant_strikes.consultant_id, consultant_strikes.type
  )
  SELECT
    ti.consultant_id,
    ti.consultant_name,
    ti.user_id,
    ti.user_email,
    ti.current_appts,
    ti.next_count AS strike_count,
    ti.next_type AS strike_type,
    v_payout_month,
    v_payout_year,
    (i.consultant_id IS NOT NULL) AS issued
  FROM to_issue ti
  LEFT JOIN inserted i ON i.consultant_id = ti.consultant_id;
END;
$$;
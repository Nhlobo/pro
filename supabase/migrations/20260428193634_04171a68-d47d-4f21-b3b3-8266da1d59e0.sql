CREATE OR REPLACE FUNCTION public.is_sales_consultant_position(_position TEXT, _user_type TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text TEXT := LOWER(TRIM(CONCAT_WS(' ', COALESCE(_position, ''), COALESCE(_user_type, ''))));
  v_words TEXT;
  v_compact TEXT;
BEGIN
  v_words := REGEXP_REPLACE(v_text, '[^a-z0-9]+', ' ', 'g');
  v_words := REGEXP_REPLACE(TRIM(v_words), '\s+', ' ', 'g');
  v_compact := REGEXP_REPLACE(v_text, '[^a-z0-9]+', '', 'g');

  IF v_words = '' THEN
    RETURN FALSE;
  END IF;

  IF v_words ~ '(^| )(non consultant|non sales consultant|not sales consultant)($| )'
     OR v_compact LIKE '%nonconsultant%'
     OR v_compact LIKE '%nonsalesconsultant%'
     OR v_compact LIKE '%notsalesconsultant%' THEN
    RETURN FALSE;
  END IF;

  RETURN (
    (v_words ~ '(^| )sales($| )' AND v_words ~ '(^| )consultant(s)?($| )')
    OR v_compact LIKE '%salesconsultant%'
    OR v_compact LIKE '%salesconsultants%'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_target_for_position(_position TEXT, _user_type TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN public.is_sales_consultant_position(_position, _user_type) THEN 7 ELSE 2 END;
$$;

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
  v_period_start DATE := (p_run_date - INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_period_end DATE := p_run_date;
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
      public.get_sales_target_for_position(p.position, p.user_type) AS target_required,
      COUNT(cs.id) FILTER (WHERE NOT COALESCE(cs.expired, false) AND cs.expiry_date >= p_run_date)::INTEGER AS active_strikes
    FROM public.sales_consultants sc
    LEFT JOIN stats st ON st.consultant_id = sc.id
    LEFT JOIN public.consultant_strikes cs ON cs.consultant_id = sc.id
    LEFT JOIN public.profiles p ON p.id = sc.user_id
    LEFT JOIN auth.users au ON au.id = sc.user_id
    WHERE sc.is_active = true
    GROUP BY sc.id, sc.name, sc.user_id, p.email, au.email, p.position, p.user_type, st.total_appts
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
    WHERE e.current_appts < e.target_required
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
      format('Below monthly target: %s/%s qualifying scheduled assessment deals for payout period %s to %s.', ti.current_appts, ti.target_required, v_period_start, v_period_end),
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

REVOKE EXECUTE ON FUNCTION public.issue_monthly_sales_strikes(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_monthly_sales_strikes(DATE) TO service_role;
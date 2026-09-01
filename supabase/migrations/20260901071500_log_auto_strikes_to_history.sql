-- consultant_strike_history had only 5 rows while consultant_strikes had 30 --
-- 26 of those 30 were auto-issued by issue_monthly_sales_strikes (the
-- monthly-sales-strike-check cron job), which INSERTed directly into
-- consultant_strikes and never touched consultant_strike_history. Only the
-- manual admin_issue_consultant_strike / admin_override_consultant_strike
-- paths (used from the Strike Tracker UI) were logging history. Net effect:
-- the audit trail was missing ~87% of real strikes.
--
-- Adds a 'logged' insert CTE to the existing function so every auto-issued
-- strike gets a matching history row (performed_by = NULL, distinguishing
-- system-issued from admin-issued -- see the matching frontend fix in
-- useSalesIncentives.tsx / SalesDashboard.tsx that labels NULL as
-- 'System (automated)' instead of the previous incorrect 'Admin user'
-- fallback). Also backfills history for the 26 already-issued auto strikes.
CREATE OR REPLACE FUNCTION public.issue_monthly_sales_strikes(
  p_run_date date DEFAULT ((now() AT TIME ZONE 'Africa/Johannesburg'::text))::date
)
RETURNS TABLE(
  consultant_id uuid,
  consultant_name text,
  user_id uuid,
  user_email text,
  current_appts integer,
  strike_count integer,
  strike_type text,
  payout_month integer,
  payout_year integer,
  issued boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payout_month INTEGER := EXTRACT(MONTH FROM p_run_date)::INTEGER;
  v_payout_year INTEGER := EXTRACT(YEAR FROM p_run_date)::INTEGER;
  v_period_start DATE := (p_run_date - INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_period_end DATE := p_run_date;
BEGIN
  IF EXTRACT(DAY FROM p_run_date)::INTEGER <> 25 THEN
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
      p.email AS user_email,
      COALESCE(st.total_appts, 0)::INTEGER AS current_appts,
      public.get_sales_target_for_position(p.position, p.user_type) AS target_required,
      (
        SELECT COUNT(*) FROM public.consultant_strikes cs2
        WHERE cs2.consultant_id = sc.id AND NOT COALESCE(cs2.expired, false) AND cs2.expiry_date >= p_run_date
      )::INTEGER AS active_strikes
    FROM public.sales_consultants sc
    LEFT JOIN stats st ON st.consultant_id = sc.id
    LEFT JOIN public.profiles p ON p.id = sc.user_id
    WHERE sc.is_active = true
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
        SELECT 1 FROM public.consultant_strikes existing
        WHERE existing.consultant_id = e.consultant_id
          AND existing.payout_month = v_payout_month
          AND existing.payout_year = v_payout_year
      )
  ), inserted AS (
    INSERT INTO public.consultant_strikes (
      consultant_id, issued_date, expiry_date, type, reason, payout_month, payout_year
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
    RETURNING id, consultant_id, type, reason
  ), logged AS (
    INSERT INTO public.consultant_strike_history (
      consultant_id, strike_id, action, strike_type, reason, performed_by, payout_month, payout_year
    )
    SELECT i.consultant_id, i.id, 'issued', i.type, i.reason, NULL, v_payout_month, v_payout_year
    FROM inserted i
    RETURNING strike_id
  )
  SELECT
    ti.consultant_id, ti.consultant_name, ti.user_id, ti.user_email,
    ti.current_appts, ti.next_count, ti.next_type,
    v_payout_month, v_payout_year,
    (i.consultant_id IS NOT NULL) AS issued
  FROM to_issue ti
  LEFT JOIN inserted i ON i.consultant_id = ti.consultant_id;
END;
$function$;

-- Backfill history for strikes already auto-issued before this fix.
INSERT INTO public.consultant_strike_history (consultant_id, strike_id, action, strike_type, reason, performed_by, payout_month, payout_year)
SELECT cs.consultant_id, cs.id, 'issued', cs.type, cs.reason, NULL, cs.payout_month, cs.payout_year
FROM public.consultant_strikes cs
WHERE cs.reason LIKE 'Below monthly target:%'
  AND NOT EXISTS (SELECT 1 FROM public.consultant_strike_history h WHERE h.strike_id = cs.id);

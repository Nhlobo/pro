-- Fixes monthly_performance being permanently empty (0 rows, no writer anywhere
-- in the codebase) since the table was created 2026-04-07. Nothing ever wrote
-- to it: get_consultant_period_stats covers the *current* payout period live,
-- but every other month, plus incentive_earned/raf_incentive_earned/
-- medneg_incentive_earned/warning_issued, only ever came from this table --
-- so they were always blank/zero regardless of real performance.
--
-- This snapshots one payout period (25th-to-25th, matching
-- issue_monthly_sales_strikes' period math) using the same building blocks
-- already trusted elsewhere: get_consultant_period_stats for appt counts,
-- get_sales_target_for_position for the 7/2 target, incentive_tiers for
-- payout rates (mirrors calculateIncentive() in useSalesIncentives.tsx,
-- including the 4-appointment payout-eligibility floor), and
-- consultant_strikes for warning_issued (a strike is only ever issued when
-- underperforming, so EXISTS-for-this-payout-period is exact, not a guess).
CREATE OR REPLACE FUNCTION public.snapshot_monthly_performance(
  p_run_date date DEFAULT ((now() AT TIME ZONE 'Africa/Johannesburg'::text))::date
)
RETURNS SETOF public.monthly_performance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month INTEGER := EXTRACT(MONTH FROM p_run_date)::INTEGER;
  v_year INTEGER := EXTRACT(YEAR FROM p_run_date)::INTEGER;
  v_period_start DATE := (p_run_date - INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_period_end DATE := p_run_date;
  v_payout_eligible CONSTANT INTEGER := 4; -- matches PAYOUT_ELIGIBLE_APPOINTMENTS in useSalesIncentives.tsx
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT * FROM public.get_consultant_period_stats(v_period_start, v_period_end)
  ),
  base AS (
    SELECT
      sc.id AS consultant_id,
      sc.type AS consultant_type,
      public.get_sales_target_for_position(p.position, p.user_type) AS target_required,
      COALESCE(st.raf_appts, 0)::INTEGER AS raf_appts,
      COALESCE(st.medneg_appts, 0)::INTEGER AS medneg_appts,
      COALESCE(st.total_appts, 0)::INTEGER AS total_appts,
      EXISTS (
        SELECT 1 FROM public.consultant_strikes cs
        WHERE cs.consultant_id = sc.id
          AND cs.payout_month = v_month
          AND cs.payout_year = v_year
      ) AS warning_issued
    FROM public.sales_consultants sc
    LEFT JOIN stats st ON st.consultant_id = sc.id
    LEFT JOIN public.profiles p ON p.id = sc.user_id
    WHERE sc.is_active = true
  ),
  tiered AS (
    SELECT
      b.*,
      COALESCE((
        SELECT it.raf_amount FROM public.incentive_tiers it
        WHERE it.tier_type = b.consultant_type
          AND b.total_appts >= v_payout_eligible
          AND b.total_appts >= it.min_appointments
          AND (it.max_appointments IS NULL OR b.total_appts <= it.max_appointments)
        ORDER BY it.min_appointments DESC LIMIT 1
      ), 0) AS raf_rate,
      COALESCE((
        SELECT it.medneg_amount FROM public.incentive_tiers it
        WHERE it.tier_type = b.consultant_type
          AND b.total_appts >= v_payout_eligible
          AND b.total_appts >= it.min_appointments
          AND (it.max_appointments IS NULL OR b.total_appts <= it.max_appointments)
        ORDER BY it.min_appointments DESC LIMIT 1
      ), 0) AS medneg_rate
    FROM base b
  )
  INSERT INTO public.monthly_performance (
    consultant_id, month, year, raf_appts, medneg_appts, total_appts,
    raf_incentive_earned, medneg_incentive_earned, incentive_earned,
    target_met, warning_issued
  )
  SELECT
    t.consultant_id, v_month, v_year, t.raf_appts, t.medneg_appts, t.total_appts,
    t.raf_appts * t.raf_rate,
    t.medneg_appts * t.medneg_rate,
    (t.raf_appts * t.raf_rate) + (t.medneg_appts * t.medneg_rate),
    t.total_appts >= t.target_required,
    t.warning_issued
  FROM tiered t
  ON CONFLICT ON CONSTRAINT monthly_performance_consultant_id_month_year_key DO UPDATE SET
    raf_appts = EXCLUDED.raf_appts,
    medneg_appts = EXCLUDED.medneg_appts,
    total_appts = EXCLUDED.total_appts,
    raf_incentive_earned = EXCLUDED.raf_incentive_earned,
    medneg_incentive_earned = EXCLUDED.medneg_incentive_earned,
    incentive_earned = EXCLUDED.incentive_earned,
    target_met = EXCLUDED.target_met,
    warning_issued = EXCLUDED.warning_issued,
    updated_at = now()
  RETURNING *;
END;
$function$;

-- Run right after the existing monthly-sales-strike-check job (06:00 on the
-- 25th) so warning_issued can see that period's strikes once they exist.
SELECT cron.schedule(
  'monthly-performance-snapshot',
  '10 6 25 * *',
  $$SELECT public.snapshot_monthly_performance();$$
);

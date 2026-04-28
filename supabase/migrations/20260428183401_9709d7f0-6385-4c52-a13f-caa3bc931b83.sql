CREATE OR REPLACE FUNCTION public.admin_issue_consultant_strike(
  p_consultant_id UUID,
  p_type TEXT,
  p_reason TEXT DEFAULT 'Admin override',
  p_issued_date DATE DEFAULT ((now() AT TIME ZONE 'Africa/Johannesburg')::date),
  p_payout_month INTEGER DEFAULT NULL,
  p_payout_year INTEGER DEFAULT NULL
)
RETURNS public.consultant_strikes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.consultant_strikes;
  v_month INTEGER := COALESCE(p_payout_month, EXTRACT(MONTH FROM p_issued_date)::INTEGER);
  v_year INTEGER := COALESCE(p_payout_year, EXTRACT(YEAR FROM p_issued_date)::INTEGER);
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')) THEN
    RAISE EXCEPTION 'Only admins can issue strikes';
  END IF;

  IF p_type NOT IN ('verbal', 'written', 'dismissal') THEN
    RAISE EXCEPTION 'Invalid strike type';
  END IF;

  INSERT INTO public.consultant_strikes (
    consultant_id,
    issued_date,
    expiry_date,
    type,
    reason,
    payout_month,
    payout_year,
    expired
  )
  VALUES (
    p_consultant_id,
    p_issued_date,
    (p_issued_date + INTERVAL '120 days')::date,
    p_type,
    COALESCE(NULLIF(trim(p_reason), ''), 'Admin override'),
    v_month,
    v_year,
    false
  )
  ON CONFLICT (consultant_id, payout_month, payout_year)
  WHERE payout_month IS NOT NULL AND payout_year IS NOT NULL
  DO UPDATE SET
    issued_date = EXCLUDED.issued_date,
    expiry_date = EXCLUDED.expiry_date,
    type = EXCLUDED.type,
    reason = EXCLUDED.reason,
    expired = false,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_override_consultant_strike(
  p_strike_id UUID,
  p_reason TEXT DEFAULT 'Admin override - strike removed'
)
RETURNS public.consultant_strikes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.consultant_strikes;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')) THEN
    RAISE EXCEPTION 'Only admins can override strikes';
  END IF;

  UPDATE public.consultant_strikes
  SET
    expired = true,
    expiry_date = LEAST(expiry_date, (now() AT TIME ZONE 'Africa/Johannesburg')::date),
    reason = COALESCE(reason || ' | ', '') || COALESCE(NULLIF(trim(p_reason), ''), 'Admin override - strike removed'),
    updated_at = now()
  WHERE id = p_strike_id
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Strike not found';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_consultant_deal_details(p_start DATE, p_end DATE, p_consultant_id UUID DEFAULT NULL)
RETURNS TABLE (
  appointment_id UUID,
  consultant_id UUID,
  consultant_name TEXT,
  user_full_name TEXT,
  claimant_name TEXT,
  claimant_auto_id TEXT,
  appointment_date DATE,
  closed_date DATE,
  matter_type TEXT,
  payment_status TEXT,
  deposit_amount NUMERIC,
  service_fee NUMERIC,
  referring_attorney TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS appointment_id,
    sc.id AS consultant_id,
    sc.name AS consultant_name,
    trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS user_full_name,
    trim(c.first_name || ' ' || c.last_name) AS claimant_name,
    c.auto_id AS claimant_auto_id,
    a.appointment_date::date AS appointment_date,
    COALESCE(a.payment_date::date, a.appointment_date::date) AS closed_date,
    a.matter_type,
    a.payment_status,
    COALESCE(a.deposit_amount, 0)::NUMERIC AS deposit_amount,
    COALESCE(a.service_fee, 0)::NUMERIC AS service_fee,
    a.referring_attorney
  FROM public.appointments a
  JOIN public.sales_consultants sc ON sc.id = a.sales_consultant_id
  LEFT JOIN public.profiles p ON p.id = sc.user_id
  LEFT JOIN public.claimants c ON c.id = a.claimant_id
  WHERE a.deleted_at IS NULL
    AND a.sales_consultant_id IS NOT NULL
    AND (p_consultant_id IS NULL OR sc.id = p_consultant_id)
    AND COALESCE(a.payment_date::date, a.appointment_date::date) >= p_start
    AND COALESCE(a.payment_date::date, a.appointment_date::date) <= p_end
    AND (
      COALESCE(a.deposit_amount, 0) > 0
      OR COALESCE(a.payment_status, '') IN ('deposit', 'full_payment', 'paid')
    )
    AND (
      sc.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'employee')
    )
  ORDER BY COALESCE(a.payment_date::date, a.appointment_date::date) DESC, a.appointment_date DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_issue_consultant_strike(UUID, TEXT, TEXT, DATE, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_override_consultant_strike(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consultant_deal_details(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_consultant_strike(UUID, TEXT, TEXT, DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override_consultant_strike(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consultant_deal_details(DATE, DATE, UUID) TO authenticated;
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
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only Admin users can issue strikes';
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
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only Admin users can override strikes';
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

DROP POLICY IF EXISTS "Admins can manage strikes" ON public.consultant_strikes;

CREATE POLICY "Only admins can manage strikes"
ON public.consultant_strikes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.admin_issue_consultant_strike(UUID, TEXT, TEXT, DATE, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_override_consultant_strike(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_consultant_strike(UUID, TEXT, TEXT, DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override_consultant_strike(UUID, TEXT) TO authenticated;
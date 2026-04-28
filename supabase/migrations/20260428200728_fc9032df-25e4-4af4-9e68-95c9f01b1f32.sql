CREATE TABLE IF NOT EXISTS public.consultant_strike_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES public.sales_consultants(id) ON DELETE CASCADE,
  strike_id UUID REFERENCES public.consultant_strikes(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  strike_type TEXT,
  reason TEXT,
  performed_by UUID,
  payout_month INTEGER,
  payout_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT consultant_strike_history_action_check CHECK (action IN ('issued', 'overridden')),
  CONSTRAINT consultant_strike_history_type_check CHECK (strike_type IS NULL OR strike_type IN ('verbal', 'written', 'dismissal'))
);

ALTER TABLE public.consultant_strike_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_consultant_strike_history_consultant_created
ON public.consultant_strike_history (consultant_id, created_at DESC);

DROP POLICY IF EXISTS "Users can view own strike history" ON public.consultant_strike_history;
DROP POLICY IF EXISTS "Only admins can add strike history" ON public.consultant_strike_history;

CREATE POLICY "Users can view own strike history"
ON public.consultant_strike_history
FOR SELECT
TO authenticated
USING (
  consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'employee')
);

CREATE POLICY "Only admins can add strike history"
ON public.consultant_strike_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

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

  INSERT INTO public.consultant_strike_history (
    consultant_id,
    strike_id,
    action,
    strike_type,
    reason,
    performed_by,
    payout_month,
    payout_year
  )
  VALUES (
    p_consultant_id,
    v_result.id,
    'issued',
    p_type,
    COALESCE(NULLIF(trim(p_reason), ''), 'Admin override'),
    auth.uid(),
    v_month,
    v_year
  );

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

  INSERT INTO public.consultant_strike_history (
    consultant_id,
    strike_id,
    action,
    strike_type,
    reason,
    performed_by,
    payout_month,
    payout_year
  )
  VALUES (
    v_result.consultant_id,
    v_result.id,
    'overridden',
    v_result.type,
    COALESCE(NULLIF(trim(p_reason), ''), 'Admin override - strike removed'),
    auth.uid(),
    v_result.payout_month,
    v_result.payout_year
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_issue_consultant_strike(UUID, TEXT, TEXT, DATE, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_override_consultant_strike(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_consultant_strike(UUID, TEXT, TEXT, DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override_consultant_strike(UUID, TEXT) TO authenticated;
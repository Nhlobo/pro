-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 2 (schema addendum)
--
-- Phase 1 already created every table Phase 2 needs
-- (external_portal_access_links, external_portal_otp_codes,
-- external_portal_sessions, external_portal_login_history). This
-- migration adds exactly one thing: an admin-only RPC to revoke a
-- live external portal session from the Active Sessions admin page.
-- Token issuance/verification itself happens in the new edge
-- functions (service role, bypasses RLS) — not in SQL.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.external_portal_revoke_session(
  _session_id UUID,
  _reason TEXT DEFAULT 'Revoked by admin'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can revoke external portal sessions';
  END IF;

  UPDATE public.external_portal_sessions
  SET revoked_at = now(), revoked_reason = _reason
  WHERE id = _session_id AND revoked_at IS NULL
  RETURNING account_id INTO v_account_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Session not found or already revoked';
  END IF;

  PERFORM public.external_portal_log_audit(
    'admin', auth.uid(), v_account_id, 'session_revoked',
    jsonb_build_object('session_id', _session_id, 'reason', _reason)
  );
END;
$$;

-- Revoke ALL of a given account's live sessions in one call — used when
-- an account is paused/expired/deleted so any device already signed in
-- is immediately logged out too.
CREATE OR REPLACE FUNCTION public.external_portal_revoke_all_sessions(
  _account_id UUID,
  _reason TEXT DEFAULT 'Account status changed'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can revoke external portal sessions';
  END IF;

  UPDATE public.external_portal_sessions
  SET revoked_at = now(), revoked_reason = _reason
  WHERE account_id = _account_id AND revoked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    PERFORM public.external_portal_log_audit(
      'admin', auth.uid(), _account_id, 'all_sessions_revoked',
      jsonb_build_object('count', v_count, 'reason', _reason)
    );
  END IF;

  RETURN v_count;
END;
$$;

-- Hook account status changes to auto-revoke sessions: pausing,
-- expiring, or deleting an account should not leave an already-issued
-- session usable.
CREATE OR REPLACE FUNCTION public.external_portal_set_account_status(
  _account_id UUID,
  _new_status public.external_portal_account_status,
  _reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can change external portal account status';
  END IF;

  UPDATE public.external_portal_accounts
  SET
    status = _new_status,
    paused_at = CASE WHEN _new_status = 'paused' THEN now() ELSE paused_at END,
    paused_reason = CASE WHEN _new_status = 'paused' THEN _reason ELSE paused_reason END,
    expired_at = CASE WHEN _new_status = 'expired' THEN now() ELSE expired_at END,
    expired_reason = CASE WHEN _new_status = 'expired' THEN _reason ELSE expired_reason END,
    deleted_at = CASE WHEN _new_status = 'deleted' THEN now() ELSE NULL END,
    deleted_by = CASE WHEN _new_status = 'deleted' THEN auth.uid() ELSE NULL END
  WHERE id = _account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'External portal account % not found', _account_id;
  END IF;

  IF _new_status <> 'deleted' THEN
    UPDATE public.external_portal_accounts
    SET deleted_at = NULL, deleted_by = NULL
    WHERE id = _account_id;
  END IF;

  IF _new_status <> 'active' THEN
    UPDATE public.external_portal_sessions
    SET revoked_at = now(), revoked_reason = 'Account status changed to ' || _new_status
    WHERE account_id = _account_id AND revoked_at IS NULL;
  END IF;

  PERFORM public.external_portal_log_audit(
    'admin', auth.uid(), _account_id,
    'status_changed',
    jsonb_build_object('new_status', _new_status, 'reason', _reason)
  );
END;
$$;

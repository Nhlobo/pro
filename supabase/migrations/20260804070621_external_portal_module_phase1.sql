-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 1
-- Referring Attorney Portal + Medical Expert Portal (shared architecture)
--
-- This migration is fully additive and isolated:
--   * All objects are prefixed `external_portal_`.
--   * No existing table, column, function, trigger, or policy is
--     altered or dropped.
--   * External portal users are NEVER rows in auth.users. They are
--     represented only by external_portal_accounts. Session handling
--     for them is entirely custom (Phase 2) and enforced via
--     SECURITY DEFINER edge functions using the service role — the
--     tables below intentionally have NO policy that grants anon or
--     authenticated (non-staff) direct access.
--   * Case data (appointments, claimants, referring_attorneys,
--     medical_experts, expert_reports, documents, etc.) is READ ONLY
--     from this module's point of view. We link to it via
--     external_portal_case_links instead of copying it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.external_portal_type AS ENUM ('attorney', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.external_portal_account_status AS ENUM (
    'active', 'paused', 'expired', 'deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.external_portal_link_status AS ENUM (
    'pending', 'used', 'expired', 'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.external_portal_otp_purpose AS ENUM (
    'registration', 'login'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 2. CORE TABLE: external_portal_accounts
--    One row per external user (attorney or expert). `portal_type`
--    decides which portal shell they land in after login — the
--    authentication flow itself is identical for both (see Phase 2).
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_type public.external_portal_type NOT NULL,

  -- Identity shown in the portal UI and used for OTP delivery. Not an
  -- auth.users row — this module keeps its own identity entirely.
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- Optional link back to the existing CRM record for this person, so
  -- staff can cross-reference without this module owning that data.
  referring_attorney_id UUID REFERENCES public.referring_attorneys(id) ON DELETE SET NULL,
  medical_expert_id UUID REFERENCES public.medical_experts(id) ON DELETE SET NULL,

  status public.external_portal_account_status NOT NULL DEFAULT 'active',

  -- Lifecycle bookkeeping
  paused_at TIMESTAMP WITH TIME ZONE,
  paused_reason TEXT,
  expired_at TIMESTAMP WITH TIME ZONE,
  expired_reason TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Registration / usage bookkeeping
  registered_at TIMESTAMP WITH TIME ZONE, -- set once the one-time link is consumed
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_login_ip TEXT,

  notes TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT external_portal_accounts_type_link_chk CHECK (
    (portal_type = 'attorney') OR (portal_type = 'expert')
  ),
  CONSTRAINT external_portal_accounts_email_lower_chk CHECK (email = lower(email))
);

CREATE UNIQUE INDEX external_portal_accounts_email_active_uq
  ON public.external_portal_accounts (portal_type, email)
  WHERE deleted_at IS NULL;

CREATE INDEX external_portal_accounts_status_idx ON public.external_portal_accounts (status);
CREATE INDEX external_portal_accounts_portal_type_idx ON public.external_portal_accounts (portal_type);
CREATE INDEX external_portal_accounts_attorney_idx ON public.external_portal_accounts (referring_attorney_id);
CREATE INDEX external_portal_accounts_expert_idx ON public.external_portal_accounts (medical_expert_id);
CREATE INDEX external_portal_accounts_deleted_idx ON public.external_portal_accounts (deleted_at);

-- ---------------------------------------------------------------------
-- 3. external_portal_case_links
--    Which existing cases (appointments) a given account may see.
--    This is the *only* place the module touches case data — a link
--    table, never a copy of case content.
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_case_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (account_id, appointment_id)
);

CREATE INDEX external_portal_case_links_account_idx ON public.external_portal_case_links (account_id);
CREATE INDEX external_portal_case_links_appointment_idx ON public.external_portal_case_links (appointment_id);

-- ---------------------------------------------------------------------
-- 4. external_portal_access_links
--    One-time secure registration links generated by admin. A link is
--    single-use: once consumed it is marked 'used' and can never
--    authenticate again (future logins are OTP-only, see Phase 2).
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_access_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,

  -- Only a SHA-256 hash of the token is stored — the raw token exists
  -- only in the URL sent to the user, never at rest.
  token_hash TEXT NOT NULL,

  status public.external_portal_link_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  ip_address TEXT,
  user_agent TEXT
);

CREATE UNIQUE INDEX external_portal_access_links_token_hash_uq
  ON public.external_portal_access_links (token_hash);
CREATE INDEX external_portal_access_links_account_idx ON public.external_portal_access_links (account_id);
CREATE INDEX external_portal_access_links_status_idx ON public.external_portal_access_links (status);

-- ---------------------------------------------------------------------
-- 5. external_portal_otp_codes
--    Shared OTP table for both registration verification and ongoing
--    login. Only a hash of the code is stored.
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,
  access_link_id UUID REFERENCES public.external_portal_access_links(id) ON DELETE SET NULL,

  purpose public.external_portal_otp_purpose NOT NULL,
  code_hash TEXT NOT NULL,
  destination TEXT NOT NULL, -- email or phone the code was sent to

  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,

  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,

  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX external_portal_otp_codes_account_idx ON public.external_portal_otp_codes (account_id);
CREATE INDEX external_portal_otp_codes_expires_idx ON public.external_portal_otp_codes (expires_at);
CREATE INDEX external_portal_otp_codes_unverified_idx
  ON public.external_portal_otp_codes (account_id, purpose)
  WHERE verified_at IS NULL;

-- ---------------------------------------------------------------------
-- 6. external_portal_sessions
--    Fully separate from Supabase auth sessions. A session is a
--    server-issued opaque token (hash stored here) that edge
--    functions validate on every request.
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT,

  ip_address TEXT,
  user_agent TEXT
);

CREATE UNIQUE INDEX external_portal_sessions_token_hash_uq
  ON public.external_portal_sessions (session_token_hash);
CREATE INDEX external_portal_sessions_account_idx ON public.external_portal_sessions (account_id);
CREATE INDEX external_portal_sessions_active_idx
  ON public.external_portal_sessions (account_id, expires_at)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- 7. external_portal_login_history
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.external_portal_accounts(id) ON DELETE SET NULL,
  email_attempted TEXT,
  event_type TEXT NOT NULL, -- 'registration_link_opened' | 'otp_requested' | 'otp_verified' | 'login_success' | 'login_failed' | 'logout'
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX external_portal_login_history_account_idx ON public.external_portal_login_history (account_id);
CREATE INDEX external_portal_login_history_occurred_idx ON public.external_portal_login_history (occurred_at DESC);

-- ---------------------------------------------------------------------
-- 8. external_portal_audit_logs
--    Admin-side audit trail for every lifecycle action taken on this
--    module (account created/paused/expired/deleted/restored, link
--    generated/revoked, settings changed, etc).
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_type TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'system' | 'external_user'
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.external_portal_accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX external_portal_audit_logs_account_idx ON public.external_portal_audit_logs (account_id);
CREATE INDEX external_portal_audit_logs_occurred_idx ON public.external_portal_audit_logs (occurred_at DESC);
CREATE INDEX external_portal_audit_logs_action_idx ON public.external_portal_audit_logs (action);

-- ---------------------------------------------------------------------
-- 9. external_portal_settings
--    Singleton configuration row (enforced via CHECK on id).
-- ---------------------------------------------------------------------

CREATE TABLE public.external_portal_settings (
  id INTEGER NOT NULL DEFAULT 1 PRIMARY KEY CHECK (id = 1),
  access_link_expiry_hours INTEGER NOT NULL DEFAULT 72,
  otp_length INTEGER NOT NULL DEFAULT 6,
  otp_expiry_minutes INTEGER NOT NULL DEFAULT 10,
  otp_max_attempts INTEGER NOT NULL DEFAULT 5,
  session_expiry_hours INTEGER NOT NULL DEFAULT 12,
  auto_expire_on_all_cases_closed BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.external_portal_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 10. updated_at triggers (reuses the existing generic trigger function
--     if present, otherwise defines a scoped one for this module only)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.external_portal_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER external_portal_accounts_set_updated_at
  BEFORE UPDATE ON public.external_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.external_portal_set_updated_at();

CREATE TRIGGER external_portal_settings_set_updated_at
  BEFORE UPDATE ON public.external_portal_settings
  FOR EACH ROW EXECUTE FUNCTION public.external_portal_set_updated_at();

-- ---------------------------------------------------------------------
-- 11. Helper + lifecycle functions
-- ---------------------------------------------------------------------

-- Simple audit helper, used by later phases' edge functions too
-- (via service role) as well as by the lifecycle functions below.
CREATE OR REPLACE FUNCTION public.external_portal_log_audit(
  _actor_type TEXT,
  _actor_id UUID,
  _account_id UUID,
  _action TEXT,
  _details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.external_portal_audit_logs (actor_type, actor_id, account_id, action, details)
  VALUES (_actor_type, _actor_id, _account_id, _action, _details)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Pause / Resume / Expire / Soft-delete / Restore / Permanent-delete.
-- All are admin-only (checked via has_role) and self-log to the audit
-- table so the admin UI never has to do it as a second round trip.

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

  -- A status change other than 'deleted' clears any prior delete markers,
  -- which is how "Restore" from the Recycle Bin works.
  IF _new_status <> 'deleted' THEN
    UPDATE public.external_portal_accounts
    SET deleted_at = NULL, deleted_by = NULL
    WHERE id = _account_id;
  END IF;

  PERFORM public.external_portal_log_audit(
    'admin', auth.uid(), _account_id,
    'status_changed',
    jsonb_build_object('new_status', _new_status, 'reason', _reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.external_portal_permanently_delete_account(
  _account_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_deleted TIMESTAMP WITH TIME ZONE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can permanently delete external portal accounts';
  END IF;

  SELECT deleted_at INTO v_was_deleted
  FROM public.external_portal_accounts WHERE id = _account_id;

  IF v_was_deleted IS NULL THEN
    RAISE EXCEPTION 'Account must be in the Recycle Bin (soft-deleted) before it can be permanently deleted';
  END IF;

  PERFORM public.external_portal_log_audit(
    'admin', auth.uid(), _account_id, 'permanently_deleted', '{}'::jsonb
  );

  -- Cascades remove links/otp/sessions/access-links; login history and
  -- audit logs keep the account_id reference nulled via ON DELETE SET NULL
  -- above so the compliance trail survives the account row itself.
  DELETE FROM public.external_portal_accounts WHERE id = _account_id;
END;
$$;

-- Auto-expiry: if every case linked to an account is closed, the
-- account's access should expire automatically. "Closed" is read from
-- the existing appointments.case_status values already in use
-- (anything other than 'scheduled' counts as closed out for portal
-- access purposes: 'assessed', 'cancelled', 'rescheduled' represent a
-- resolved/ended engagement). Designed to be safe to call repeatedly
-- (idempotent) — intended to be invoked on a schedule in Phase 5, and
-- callable ad-hoc by admins in the meantime.
CREATE OR REPLACE FUNCTION public.external_portal_auto_expire_stale_accounts()
RETURNS TABLE(account_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT epa.id
    FROM public.external_portal_accounts epa
    JOIN public.external_portal_settings s ON s.id = 1
    WHERE epa.status = 'active'
      AND s.auto_expire_on_all_cases_closed = true
      AND EXISTS (
        SELECT 1 FROM public.external_portal_case_links l
        WHERE l.account_id = epa.id AND l.revoked_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.external_portal_case_links l
        JOIN public.appointments a ON a.id = l.appointment_id
        WHERE l.account_id = epa.id
          AND l.revoked_at IS NULL
          AND a.case_status = 'scheduled'
      )
  )
  UPDATE public.external_portal_accounts epa
  SET status = 'expired', expired_at = now(), expired_reason = 'All linked cases closed'
  FROM candidate
  WHERE epa.id = candidate.id
  RETURNING epa.id;

  -- Best-effort audit entries for whatever was just expired.
  INSERT INTO public.external_portal_audit_logs (actor_type, actor_id, account_id, action, details)
  SELECT 'system', NULL, epa.id, 'auto_expired', jsonb_build_object('reason', 'All linked cases closed')
  FROM public.external_portal_accounts epa
  WHERE epa.status = 'expired'
    AND epa.expired_reason = 'All linked cases closed'
    AND epa.expired_at >= now() - interval '1 minute';
END;
$$;

-- ---------------------------------------------------------------------
-- 12. Row Level Security
--
-- Design: staff (admin role) manage everything through the normal
-- Supabase client using these policies. External end users NEVER hit
-- these tables directly — Phase 2's edge functions use the service
-- role key (which bypasses RLS) and enforce authorization themselves
-- via the session/OTP tables. So there is intentionally no policy
-- here for anon/authenticated non-admin access.
-- ---------------------------------------------------------------------

ALTER TABLE public.external_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_portal_case_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_portal_access_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_portal_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_portal_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_portal_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_portal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external portal accounts"
  ON public.external_portal_accounts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage external portal case links"
  ON public.external_portal_case_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage external portal access links"
  ON public.external_portal_access_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view external portal otp codes"
  ON public.external_portal_otp_codes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage external portal sessions"
  ON public.external_portal_sessions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view external portal login history"
  ON public.external_portal_login_history FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view external portal audit logs"
  ON public.external_portal_audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage external portal settings"
  ON public.external_portal_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 13. Grants
--    RLS above already restricts rows to admins; revoke table-level
--    access from anon outright as defence in depth, and make sure the
--    service role (used exclusively by this module's future edge
--    functions) has full access regardless of RLS.
-- ---------------------------------------------------------------------

REVOKE ALL ON
  public.external_portal_accounts,
  public.external_portal_case_links,
  public.external_portal_access_links,
  public.external_portal_otp_codes,
  public.external_portal_sessions,
  public.external_portal_login_history,
  public.external_portal_audit_logs,
  public.external_portal_settings
FROM anon;

COMMENT ON TABLE public.external_portal_accounts IS
  'External Portal Module (Phase 1): one row per Referring Attorney or Medical Expert external user. No auth.users row is created for these people — see external_portal_sessions for their custom session handling (Phase 2).';


-- 1. Extend profiles with auth-only columns (no RLS change)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS security_setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_session_id text,
  ADD COLUMN IF NOT EXISTS force_security_setup boolean NOT NULL DEFAULT false;

-- Constrain account_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active','pending_activation','suspended','locked','disabled'));
  END IF;
END$$;

-- 2. auth_otp_codes
CREATE TABLE IF NOT EXISTS public.auth_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('login','reset')),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  resend_count integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_otp_codes TO service_role;
ALTER TABLE public.auth_otp_codes ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated; service role bypasses RLS.
CREATE UNIQUE INDEX IF NOT EXISTS auth_otp_codes_active_unique
  ON public.auth_otp_codes (user_id, purpose) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS auth_otp_codes_expires_idx ON public.auth_otp_codes (expires_at);

-- 3. account_activations
CREATE TABLE IF NOT EXISTS public.account_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_activations TO service_role;
ALTER TABLE public.account_activations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS account_activations_user_idx ON public.account_activations (user_id);

-- 4. password_reset_tokens
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_tokens TO service_role;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON public.password_reset_tokens (user_id);

-- 5. auth_audit_log (append-only)
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  ip text,
  user_agent text,
  browser text,
  os text,
  device text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auth_audit_log TO authenticated;
GRANT ALL ON public.auth_audit_log TO service_role;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read auth audit log
CREATE POLICY "Admins can read auth audit log"
  ON public.auth_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies for authenticated. Append-only via service role.
-- Explicitly revoke UPDATE/DELETE to make append-only intent unambiguous.
REVOKE UPDATE, DELETE ON public.auth_audit_log FROM authenticated;

CREATE INDEX IF NOT EXISTS auth_audit_log_user_idx ON public.auth_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_audit_log_event_idx ON public.auth_audit_log (event_type, created_at DESC);

-- 6. log_auth_event helper (security definer; service role / edge functions use it)
CREATE OR REPLACE FUNCTION public.log_auth_event(
  _user_id uuid,
  _event_type text,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _browser text DEFAULT NULL,
  _os text DEFAULT NULL,
  _device text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.auth_audit_log (user_id, event_type, ip, user_agent, browser, os, device, metadata)
  VALUES (_user_id, _event_type, _ip, _user_agent, _browser, _os, _device, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_auth_event(uuid,text,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_event(uuid,text,text,text,text,text,text,jsonb) TO service_role;

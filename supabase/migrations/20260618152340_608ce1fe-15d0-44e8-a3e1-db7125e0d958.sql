
-- 1. Profile additive columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS security_setup_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS failed_login_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active','pending_activation','suspended','disabled'));

-- 2. Activation tokens
CREATE TABLE IF NOT EXISTS public.auth_activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_activation_tokens_user ON public.auth_activation_tokens(user_id);

GRANT SELECT ON public.auth_activation_tokens TO authenticated;
GRANT ALL ON public.auth_activation_tokens TO service_role;
ALTER TABLE public.auth_activation_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read activation tokens" ON public.auth_activation_tokens
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Password reset tokens
CREATE TABLE IF NOT EXISTS public.auth_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_user ON public.auth_password_reset_tokens(user_id);

GRANT SELECT ON public.auth_password_reset_tokens TO authenticated;
GRANT ALL ON public.auth_password_reset_tokens TO service_role;
ALTER TABLE public.auth_password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read pw reset tokens" ON public.auth_password_reset_tokens
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Login OTPs
CREATE TABLE IF NOT EXISTS public.auth_login_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  otp_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  expires_at timestamptz NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  resend_count int NOT NULL DEFAULT 0,
  superseded_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_login_otps_purpose_check CHECK (purpose IN ('login','setup','reset'))
);
CREATE INDEX IF NOT EXISTS idx_auth_login_otps_user ON public.auth_login_otps(user_id);

GRANT SELECT ON public.auth_login_otps TO authenticated;
GRANT ALL ON public.auth_login_otps TO service_role;
ALTER TABLE public.auth_login_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read otps" ON public.auth_login_otps
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Active sessions
CREATE TABLE IF NOT EXISTS public.auth_active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  revoked_at timestamptz,
  revoked_reason text
);
CREATE INDEX IF NOT EXISTS idx_auth_active_sessions_user ON public.auth_active_sessions(user_id);

GRANT SELECT ON public.auth_active_sessions TO authenticated;
GRANT ALL ON public.auth_active_sessions TO service_role;
ALTER TABLE public.auth_active_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read sessions" ON public.auth_active_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 6. Auth events (append-only, admin-read)
CREATE TABLE IF NOT EXISTS public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  event_type text NOT NULL,
  ip text,
  user_agent text,
  device text,
  browser text,
  os text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON public.auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_type_time ON public.auth_events(event_type, created_at DESC);

-- Strictly insert+select. No UPDATE/DELETE for anyone (service_role uses bypass for inserts only via SECURITY DEFINER).
GRANT SELECT ON public.auth_events TO authenticated;
GRANT SELECT, INSERT ON public.auth_events TO service_role;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read auth events" ON public.auth_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Block any future UPDATE/DELETE attempts even if grants get added later
CREATE OR REPLACE FUNCTION public.auth_events_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'auth_events is append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_auth_events_no_update ON public.auth_events;
CREATE TRIGGER trg_auth_events_no_update
  BEFORE UPDATE OR DELETE ON public.auth_events
  FOR EACH ROW EXECUTE FUNCTION public.auth_events_block_mutation();

-- 7. SECURITY DEFINER helper for edge functions / triggers to write events
CREATE OR REPLACE FUNCTION public.record_auth_event(
  _user_id uuid,
  _email text,
  _event_type text,
  _ip text,
  _user_agent text,
  _device text,
  _browser text,
  _os text,
  _metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.auth_events(user_id, email, event_type, ip, user_agent, device, browser, os, metadata)
  VALUES (_user_id, _email, _event_type, _ip, _user_agent, _device, _browser, _os, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_auth_event(uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_auth_event(uuid,text,text,text,text,text,text,text,jsonb) TO service_role;

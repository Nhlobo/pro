
-- ============ PASSKEYS / WEBAUTHN ============
CREATE TABLE IF NOT EXISTS public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_name text,
  transports text[],
  aaguid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_passkeys TO authenticated;
GRANT ALL ON public.user_passkeys TO service_role;

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own passkeys"
ON public.user_passkeys
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all passkeys"
ON public.user_passkeys
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON public.user_passkeys(user_id);

-- ============ TRUSTED DEVICES ============
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_hash text NOT NULL,
  device_name text,
  user_agent text,
  ip_address text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_devices TO authenticated;
GRANT ALL ON public.trusted_devices TO service_role;

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trusted devices"
ON public.trusted_devices
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all trusted devices"
ON public.trusted_devices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON public.trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_token_hash ON public.trusted_devices(device_token_hash);

-- Auto-purge expired trusted devices when queried (cleanup helper)
CREATE OR REPLACE FUNCTION public.purge_expired_trusted_devices()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.trusted_devices WHERE expires_at < now();
$$;

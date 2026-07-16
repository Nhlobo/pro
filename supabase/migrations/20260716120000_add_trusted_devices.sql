CREATE TABLE public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  sign_count bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_label text NOT NULL DEFAULT 'Trusted device',
  user_agent text,
  platform text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trusted_devices TO authenticated;
GRANT ALL ON public.trusted_devices TO service_role;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own devices" ON public.trusted_devices FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
GRANT UPDATE (device_label, revoked_at, revoked_by, revoked_reason) ON public.trusted_devices TO authenticated;
CREATE POLICY "users update own device" ON public.trusted_devices FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX trusted_devices_user_idx ON public.trusted_devices(user_id) WHERE revoked_at IS NULL;
CREATE OR REPLACE FUNCTION public.trusted_devices_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_trusted_devices_updated BEFORE UPDATE ON public.trusted_devices FOR EACH ROW EXECUTE FUNCTION public.trusted_devices_touch_updated_at();
CREATE TABLE public.trusted_device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.trusted_devices(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trusted_device_events TO authenticated;
GRANT ALL ON public.trusted_device_events TO service_role;
ALTER TABLE public.trusted_device_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own events" ON public.trusted_device_events FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX trusted_device_events_user_idx ON public.trusted_device_events(user_id, created_at DESC);
CREATE TABLE public.trusted_device_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.trusted_device_challenges TO service_role;
ALTER TABLE public.trusted_device_challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX trusted_device_challenges_user_idx ON public.trusted_device_challenges(user_id, purpose, created_at DESC);

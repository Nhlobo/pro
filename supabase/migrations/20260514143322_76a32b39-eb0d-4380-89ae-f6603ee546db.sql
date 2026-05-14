-- =============================================================
-- HIPAA / GDPR — encryption helpers + write-audit triggers
-- =============================================================

-- 1. Extensions ------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- 2. Dedicated PII encryption key ------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pgsodium.valid_key WHERE name = 'pii_encryption_key'
  ) THEN
    PERFORM pgsodium.create_key(
      key_type := 'aead-det',
      name     := 'pii_encryption_key'
    );
  END IF;
END $$;

-- 3. SECURITY DEFINER encrypt / decrypt helpers ---------------
CREATE OR REPLACE FUNCTION public.encrypt_pii(plaintext text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id uuid;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'encrypt_pii: admin role required';
  END IF;
  SELECT id INTO v_key_id FROM pgsodium.valid_key WHERE name = 'pii_encryption_key';
  RETURN pgsodium.crypto_aead_det_encrypt(
    convert_to(plaintext, 'utf8'),
    convert_to('pii', 'utf8'),
    v_key_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(ciphertext bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id uuid;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'decrypt_pii: admin role required';
  END IF;
  SELECT id INTO v_key_id FROM pgsodium.valid_key WHERE name = 'pii_encryption_key';
  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      ciphertext,
      convert_to('pii', 'utf8'),
      v_key_id
    ),
    'utf8'
  );
END $$;

REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_pii(bytea) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_pii(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_pii(bytea) TO authenticated;

-- 4. Generic write-audit trigger -------------------------------
CREATE OR REPLACE FUNCTION public.audit_write_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_record_id  uuid;
  v_old        jsonb;
  v_new        jsonb;
  v_diff       jsonb := '{}'::jsonb;
  v_key        text;
BEGIN
  BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN v_user_email := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record_id := (v_old->>'id')::uuid;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_diff := v_diff || jsonb_build_object(
          v_key,
          jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
      END IF;
    END LOOP;
    -- Skip log if effectively unchanged (e.g. trigger-only updated_at bump)
    IF v_diff = '{}'::jsonb OR v_diff = jsonb_build_object(
        'updated_at', jsonb_build_object('old', v_old->'updated_at', 'new', v_new->'updated_at')
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action_type,
    old_values, new_values, changed_fields,
    user_id, user_email, function_area, description
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old,
    v_new,
    NULLIF(v_diff, '{}'::jsonb),
    v_user_id,
    v_user_email,
    'compliance_audit',
    format('%s on %s', TG_OP, TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- 5. Attach triggers to sensitive tables -----------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'claimants',
    'referring_attorneys',
    'medical_experts',
    'expert_reports',
    'appointment_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_writes_%s ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_writes_%1$s
         AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.audit_write_event()',
      t
    );
  END LOOP;
END $$;
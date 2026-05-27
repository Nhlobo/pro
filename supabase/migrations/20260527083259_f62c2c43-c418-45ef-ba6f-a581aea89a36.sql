CREATE OR REPLACE FUNCTION public.log_finance_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_changed jsonb := '[]'::jsonb;
  v_record_id uuid;
  v_desc text;
  k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := NEW.id;
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old->k IS DISTINCT FROM v_new->k AND k NOT IN ('updated_at') THEN
        v_changed := v_changed || to_jsonb(k);
      END IF;
    END LOOP;
    IF jsonb_array_length(v_changed) = 0 THEN
      RETURN NEW;
    END IF;
  ELSE
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := OLD.id;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  END IF;

  v_desc := format('%s on %s', v_action, TG_TABLE_NAME);

  INSERT INTO public.audit_logs (
    table_name, record_id, action_type, old_values, new_values,
    changed_fields, user_id, user_email, function_area, description
  ) VALUES (
    TG_TABLE_NAME, v_record_id, v_action, v_old, v_new,
    v_changed, v_uid, v_email, 'finance', v_desc
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_aod_documents ON public.aod_documents;
CREATE TRIGGER trg_audit_aod_documents
AFTER INSERT OR UPDATE OR DELETE ON public.aod_documents
FOR EACH ROW EXECUTE FUNCTION public.log_finance_audit();

DROP TRIGGER IF EXISTS trg_audit_aod_payments ON public.aod_payments;
CREATE TRIGGER trg_audit_aod_payments
AFTER INSERT OR UPDATE OR DELETE ON public.aod_payments
FOR EACH ROW EXECUTE FUNCTION public.log_finance_audit();

DROP TRIGGER IF EXISTS trg_audit_short_term_agreements ON public.short_term_agreements;
CREATE TRIGGER trg_audit_short_term_agreements
AFTER INSERT OR UPDATE OR DELETE ON public.short_term_agreements
FOR EACH ROW EXECUTE FUNCTION public.log_finance_audit();
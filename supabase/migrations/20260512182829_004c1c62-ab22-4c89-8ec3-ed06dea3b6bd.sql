-- 1. Make audit_logs immutable: deny UPDATE and DELETE for everyone
REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;

CREATE POLICY "Audit logs are immutable - no updates"
ON public.audit_logs FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Audit logs are immutable - no deletes"
ON public.audit_logs FOR DELETE TO authenticated
USING (false);

-- 2. Generic trigger function that writes change events to audit_logs
CREATE OR REPLACE FUNCTION public.audit_case_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_action text;
  v_record_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_area text;
  k text;
BEGIN
  -- Map table -> function area
  v_area := CASE TG_TABLE_NAME
    WHEN 'appointments' THEN 'assessment'
    WHEN 'claimants' THEN 'claimant'
    WHEN 'case_management_reports' THEN 'case_management'
    WHEN 'case_timelines' THEN 'case_timeline'
    ELSE TG_TABLE_NAME
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_new := to_jsonb(NEW);
    v_record_id := (NEW).id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (NEW).id;
    -- Build changed-fields diff
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old->k IS DISTINCT FROM v_new->k THEN
        v_changed := v_changed || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
      END IF;
    END LOOP;
    -- Skip log if nothing actually changed
    IF v_changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_record_id := (OLD).id;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    table_name, record_id, action_type, old_values, new_values,
    changed_fields, user_id, user_email, function_area, description
  ) VALUES (
    TG_TABLE_NAME, v_record_id, v_action, v_old, v_new,
    NULLIF(v_changed, '{}'::jsonb), v_user_id, v_email, v_area,
    format('%s on %s', v_action, TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Attach triggers to case-related tables
DROP TRIGGER IF EXISTS trg_audit_appointments ON public.appointments;
CREATE TRIGGER trg_audit_appointments
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.audit_case_changes();

DROP TRIGGER IF EXISTS trg_audit_claimants ON public.claimants;
CREATE TRIGGER trg_audit_claimants
AFTER INSERT OR UPDATE OR DELETE ON public.claimants
FOR EACH ROW EXECUTE FUNCTION public.audit_case_changes();

DROP TRIGGER IF EXISTS trg_audit_case_management_reports ON public.case_management_reports;
CREATE TRIGGER trg_audit_case_management_reports
AFTER INSERT OR UPDATE OR DELETE ON public.case_management_reports
FOR EACH ROW EXECUTE FUNCTION public.audit_case_changes();

DROP TRIGGER IF EXISTS trg_audit_case_timelines ON public.case_timelines;
CREATE TRIGGER trg_audit_case_timelines
AFTER INSERT OR UPDATE OR DELETE ON public.case_timelines
FOR EACH ROW EXECUTE FUNCTION public.audit_case_changes();

-- 4. Function for client-side access logging (case viewed)
CREATE OR REPLACE FUNCTION public.log_case_access(
  p_table_name text,
  p_record_id uuid,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    table_name, record_id, action_type, user_id, user_email,
    function_area, description
  ) VALUES (
    p_table_name, p_record_id, 'SELECT', v_user_id, v_email,
    'case_access', COALESCE(p_description, format('Viewed %s record', p_table_name))
  );
END;
$$;
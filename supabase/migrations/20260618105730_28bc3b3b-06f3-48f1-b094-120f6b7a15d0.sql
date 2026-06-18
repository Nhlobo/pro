
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted server contexts (service role / SQL editor) have no auth.uid()
  IF auth.uid() IS NULL OR public.is_strict_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.position IS DISTINCT FROM OLD.position
     OR NEW.referring_attorney_id IS DISTINCT FROM OLD.referring_attorney_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

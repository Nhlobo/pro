
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_trail(
      'user_roles',
      NEW.id::TEXT,
      'CREATE',
      'user_management',
      NULL,
      jsonb_build_object('role', NEW.role, 'user_id', NEW.user_id),
      'Role granted: ' || NEW.role::TEXT
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_trail(
      'user_roles',
      OLD.id::TEXT,
      'DELETE',
      'user_management',
      jsonb_build_object('role', OLD.role, 'user_id', OLD.user_id),
      NULL,
      'Role revoked: ' || OLD.role::TEXT
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

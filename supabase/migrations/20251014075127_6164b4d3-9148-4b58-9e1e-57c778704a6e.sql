-- Step 1: Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'employee', 'referring_attorney', 'user');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Step 4: Create helper function to get current user's roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- Step 5: RLS Policies for user_roles table
CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 6: Migrate existing role data from profiles table
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT 
  id,
  CASE 
    WHEN role = 'admin' THEN 'admin'::app_role
    WHEN role = 'employee' THEN 'employee'::app_role
    WHEN role = 'referring_attorney' THEN 'referring_attorney'::app_role
    ELSE 'user'::app_role
  END,
  created_at
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 7: Update is_system_admin function to use user_roles
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin');
$$;

-- Step 8: Update is_referring_attorney function
CREATE OR REPLACE FUNCTION public.is_referring_attorney()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'referring_attorney');
$$;

-- Step 9: Update get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'employee' THEN 2
      WHEN 'referring_attorney' THEN 3
      ELSE 4
    END
  LIMIT 1;
$$;

-- Step 10: Create audit logging function for role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_trail(
      'user_roles',
      NEW.id,
      'CREATE',
      'user_management',
      NULL,
      jsonb_build_object('role', NEW.role, 'user_id', NEW.user_id),
      'Role granted: ' || NEW.role::TEXT
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_trail(
      'user_roles',
      OLD.id,
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

CREATE TRIGGER audit_role_changes
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION log_role_change();

-- Step 11: Fix search_path in all existing SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.check_admin_by_email()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_main_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_primary_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin');
$$;
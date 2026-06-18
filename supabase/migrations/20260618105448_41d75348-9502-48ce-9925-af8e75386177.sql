
-- =========================================================
-- Helper: strict admin check (admin role only, no employees)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_strict_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_strict_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_strict_admin() TO authenticated, service_role;

-- =========================================================
-- V-1 & V-2: profiles UPDATE + privilege escalation trigger
-- =========================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "System admins full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "System admins can delete profiles" ON public.profiles;

-- Self-update (cannot touch privileged fields; enforced by trigger below)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin-only update for any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_strict_admin())
WITH CHECK (public.is_strict_admin());

-- Admin-only delete
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_strict_admin());

-- Insert: self or admin
CREATE POLICY "Admins or self can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_strict_admin() OR auth.uid() = id);

-- Tighten the privilege-escalation trigger: only strict admin bypasses
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_strict_admin() THEN
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

-- =========================================================
-- V-3: profiles SELECT — drop sales_consultant blanket read
-- =========================================================
DROP POLICY IF EXISTS "Sales consultants can view profiles" ON public.profiles;
-- "Users can view own profile" and "Company users can view relevant profiles" remain

-- =========================================================
-- V-4: medical_experts SELECT — staff only
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view active medical experts" ON public.medical_experts;

CREATE POLICY "Staff can view medical experts"
ON public.medical_experts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

-- =========================================================
-- V-5: claimants SELECT — remove blanket sales_consultant read
-- =========================================================
DROP POLICY IF EXISTS "Sales consultants can view all claimants" ON public.claimants;
DROP POLICY IF EXISTS "Sales consultants can create claimants" ON public.claimants;
DROP POLICY IF EXISTS "Sales consultants can update claimants" ON public.claimants;
-- "Users can view claimants based on role" (admin/employee/same-firm) remains.

-- =========================================================
-- V-6: expert_payment_planner_snapshots — finance/admin only
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view planner snapshots" ON public.expert_payment_planner_snapshots;

CREATE POLICY "Finance staff can view planner snapshots"
ON public.expert_payment_planner_snapshots
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR submitted_by_id = auth.uid()
);

-- =========================================================
-- V-7: sales_consultants SELECT — staff or self only
-- =========================================================
DROP POLICY IF EXISTS "Admins and employees can view all consultants" ON public.sales_consultants;

CREATE POLICY "Staff or self can view consultants"
ON public.sales_consultants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR user_id = auth.uid()
);

-- =========================================================
-- V-8: audit_logs SELECT — staff only (no firm sharing)
-- =========================================================
DROP POLICY IF EXISTS "Users can view audit logs from their law firm" ON public.audit_logs;

CREATE POLICY "Staff can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

-- =========================================================
-- V-9: revoke anon EXECUTE on get_app_roles
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.get_app_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_roles() TO authenticated, service_role;

-- Trigger helper
CREATE OR REPLACE FUNCTION public.epp_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.epp_set_updated_at() FROM PUBLIC, anon;

-- Access predicates (SECURITY DEFINER — restricted to authenticated)
CREATE OR REPLACE FUNCTION public.epp_can_manage(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'finance'::public.app_role, 'director'::public.app_role)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.epp_can_manage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.epp_can_manage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.epp_can_view(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'finance'::public.app_role, 'director'::public.app_role, 'employee'::public.app_role)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.epp_can_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.epp_can_view(uuid) TO authenticated;

-- ===== epp_experts =====
CREATE TABLE public.epp_experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  profession text NOT NULL,
  province text,
  hpcsa_number text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_epp_experts_profession ON public.epp_experts (profession);
CREATE INDEX idx_epp_experts_province ON public.epp_experts (province);
ALTER TABLE public.epp_experts ENABLE ROW LEVEL SECURITY;
CREATE POLICY epp_experts_select ON public.epp_experts FOR SELECT TO authenticated USING (public.epp_can_view(auth.uid()));
CREATE POLICY epp_experts_insert ON public.epp_experts FOR INSERT TO authenticated WITH CHECK (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_experts_update ON public.epp_experts FOR UPDATE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_experts_delete ON public.epp_experts FOR DELETE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE TRIGGER trg_epp_experts_updated BEFORE UPDATE ON public.epp_experts
FOR EACH ROW EXECUTE FUNCTION public.epp_set_updated_at();

-- ===== epp_attorneys =====
CREATE TABLE public.epp_attorneys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_epp_attorneys_firm ON public.epp_attorneys (firm_name);
ALTER TABLE public.epp_attorneys ENABLE ROW LEVEL SECURITY;
CREATE POLICY epp_attorneys_select ON public.epp_attorneys FOR SELECT TO authenticated USING (public.epp_can_view(auth.uid()));
CREATE POLICY epp_attorneys_insert ON public.epp_attorneys FOR INSERT TO authenticated WITH CHECK (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_attorneys_update ON public.epp_attorneys FOR UPDATE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_attorneys_delete ON public.epp_attorneys FOR DELETE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE TRIGGER trg_epp_attorneys_updated BEFORE UPDATE ON public.epp_attorneys
FOR EACH ROW EXECUTE FUNCTION public.epp_set_updated_at();

-- ===== epp_claimants =====
CREATE TABLE public.epp_claimants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  id_number_masked text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_epp_claimants_name ON public.epp_claimants (full_name);
ALTER TABLE public.epp_claimants ENABLE ROW LEVEL SECURITY;
CREATE POLICY epp_claimants_select ON public.epp_claimants FOR SELECT TO authenticated USING (public.epp_can_view(auth.uid()));
CREATE POLICY epp_claimants_insert ON public.epp_claimants FOR INSERT TO authenticated WITH CHECK (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_claimants_update ON public.epp_claimants FOR UPDATE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_claimants_delete ON public.epp_claimants FOR DELETE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE TRIGGER trg_epp_claimants_updated BEFORE UPDATE ON public.epp_claimants
FOR EACH ROW EXECUTE FUNCTION public.epp_set_updated_at();

-- ===== epp_reports =====
CREATE TYPE public.epp_case_type AS ENUM ('raf', 'medical_negligence');
CREATE TYPE public.epp_report_status AS ENUM ('pending', 'in_progress', 'completed', 'released');

CREATE TABLE public.epp_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.epp_experts(id) ON DELETE RESTRICT,
  attorney_id uuid NOT NULL REFERENCES public.epp_attorneys(id) ON DELETE RESTRICT,
  claimant_id uuid REFERENCES public.epp_claimants(id) ON DELETE SET NULL,
  case_type public.epp_case_type NOT NULL DEFAULT 'raf',
  report_type text NOT NULL,
  date_taken_out date NOT NULL DEFAULT CURRENT_DATE,
  status public.epp_report_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_epp_reports_expert ON public.epp_reports (expert_id);
CREATE INDEX idx_epp_reports_attorney ON public.epp_reports (attorney_id);
CREATE INDEX idx_epp_reports_date ON public.epp_reports (date_taken_out);
CREATE INDEX idx_epp_reports_status ON public.epp_reports (status);
ALTER TABLE public.epp_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY epp_reports_select ON public.epp_reports FOR SELECT TO authenticated USING (public.epp_can_view(auth.uid()));
CREATE POLICY epp_reports_insert ON public.epp_reports FOR INSERT TO authenticated WITH CHECK (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_reports_update ON public.epp_reports FOR UPDATE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_reports_delete ON public.epp_reports FOR DELETE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE TRIGGER trg_epp_reports_updated BEFORE UPDATE ON public.epp_reports
FOR EACH ROW EXECUTE FUNCTION public.epp_set_updated_at();

-- ===== epp_invoices =====
CREATE TYPE public.epp_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.epp_payment_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');

CREATE TABLE public.epp_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.epp_reports(id) ON DELETE SET NULL,
  expert_id uuid NOT NULL REFERENCES public.epp_experts(id) ON DELETE RESTRICT,
  attorney_id uuid NOT NULL REFERENCES public.epp_attorneys(id) ON DELETE RESTRICT,
  claimant_id uuid REFERENCES public.epp_claimants(id) ON DELETE SET NULL,
  invoice_number text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0,
  planned_payment_date date,
  priority public.epp_priority NOT NULL DEFAULT 'normal',
  payment_status public.epp_payment_status NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_epp_invoices_expert ON public.epp_invoices (expert_id);
CREATE INDEX idx_epp_invoices_attorney ON public.epp_invoices (attorney_id);
CREATE INDEX idx_epp_invoices_status ON public.epp_invoices (payment_status);
CREATE INDEX idx_epp_invoices_planned ON public.epp_invoices (planned_payment_date);
CREATE INDEX idx_epp_invoices_report ON public.epp_invoices (report_id);
ALTER TABLE public.epp_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY epp_invoices_select ON public.epp_invoices FOR SELECT TO authenticated USING (public.epp_can_view(auth.uid()));
CREATE POLICY epp_invoices_insert ON public.epp_invoices FOR INSERT TO authenticated WITH CHECK (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_invoices_update ON public.epp_invoices FOR UPDATE TO authenticated USING (public.epp_can_manage(auth.uid()));
CREATE POLICY epp_invoices_delete ON public.epp_invoices FOR DELETE TO authenticated USING (public.epp_can_manage(auth.uid()));

CREATE OR REPLACE FUNCTION public.epp_invoice_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE bal numeric(12,2);
BEGIN
  bal := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.amount_paid,0), 0);
  NEW.outstanding_balance := bal;
  IF bal <= 0 AND COALESCE(NEW.amount,0) > 0 THEN
    NEW.payment_status := 'paid';
  ELSIF COALESCE(NEW.amount_paid,0) > 0 AND bal > 0 THEN
    NEW.payment_status := 'partial';
  ELSIF NEW.planned_payment_date IS NOT NULL
        AND NEW.planned_payment_date < CURRENT_DATE
        AND bal > 0 THEN
    NEW.payment_status := 'overdue';
  ELSE
    NEW.payment_status := 'unpaid';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.epp_invoice_recalc() FROM PUBLIC, anon;

CREATE TRIGGER trg_epp_invoices_recalc
BEFORE INSERT OR UPDATE ON public.epp_invoices
FOR EACH ROW EXECUTE FUNCTION public.epp_invoice_recalc();
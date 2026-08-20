-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 12
-- Individual referring-attorney isolation.
--
-- WHY: the Appointment Engine has only ever recorded who a case was
-- referred by at the FIRM level (appointments.referring_attorney_id ->
-- referring_attorneys, formerly law_firms). It has never recorded
-- which specific person at that firm the case actually belongs to —
-- an attorney_id FK was added and reverted the same day back in
-- migration 20251023210959, before any data was ever written to it.
-- External Portal accounts inherited that same firm-level grain
-- (external_portal_accounts.referring_attorney_id), so two different
-- individuals granted portal access at the same firm would see one
-- another's full case list. This migration adds the one column the
-- Appointment Engine was actually missing and repoints the External
-- Portal (only) at it. Medical Experts are untouched — medical_experts
-- already is one row per individual person, so that isolation is
-- already correct.
--
-- This does NOT touch the old, native (`/attorney-portal` login from a
-- real Supabase account created outside this module) firm-level
-- access — that keeps working exactly as before. Only sessions bridged
-- through external-portal-auth (profiles.is_external_portal_user =
-- true) are switched onto the new, narrower, individual-level check.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. referring_attorney_contacts — the individual person, at a firm.
--    This is genuinely new information, not a duplicate of anything:
--    referring_attorneys is the firm/client record, public.attorneys
--    is the unrelated sales-prospecting pipeline table, and neither
--    stores "which specific person handles this case".
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.referring_attorney_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referring_attorney_id UUID NOT NULL REFERENCES public.referring_attorneys(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referring_attorney_contacts_firm_idx
  ON public.referring_attorney_contacts (referring_attorney_id);

-- Avoid silently creating duplicate contact rows for the same person
-- at the same firm (case-insensitive email match, active rows only).
CREATE UNIQUE INDEX IF NOT EXISTS referring_attorney_contacts_firm_email_uq
  ON public.referring_attorney_contacts (referring_attorney_id, lower(email))
  WHERE email IS NOT NULL AND is_active;

-- ---------------------------------------------------------------------
-- 2. The actual assignment column on the Appointment Engine itself.
--    Nullable on purpose: per your instruction, an appointment with no
--    individual assigned yet must stay invisible to the External
--    Portal rather than being guessed at.
-- ---------------------------------------------------------------------

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS assigned_attorney_contact_id UUID
    REFERENCES public.referring_attorney_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_assigned_attorney_contact_id
  ON public.appointments (assigned_attorney_contact_id);

-- ---------------------------------------------------------------------
-- 3. Identity plumbing: profiles + external_portal_accounts both need
--    to carry the contact id, the same way they already carry
--    referring_attorney_id / expert_id.
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS attorney_contact_id UUID
    REFERENCES public.referring_attorney_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.external_portal_accounts
  ADD COLUMN IF NOT EXISTS assigned_attorney_contact_id UUID
    REFERENCES public.referring_attorney_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS external_portal_accounts_contact_idx
  ON public.external_portal_accounts (assigned_attorney_contact_id);

CREATE OR REPLACE FUNCTION public.get_current_user_attorney_contact()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT attorney_contact_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_attorney_contact() TO authenticated;
REVOKE ALL ON FUNCTION public.get_current_user_attorney_contact() FROM anon;

-- RLS on referring_attorney_contacts itself — placed after the function
-- definition above, since one of its policies calls it.
ALTER TABLE public.referring_attorney_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage referring attorney contacts"
  ON public.referring_attorney_contacts FOR ALL
  USING (is_system_admin() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (is_system_admin() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- A bridged attorney-portal user may see their own single contact row
-- (used for e.g. displaying "assigned to: <name>" in their own UI) —
-- nothing about any other contact at their firm.
CREATE POLICY "Portal users view own contact record"
  ON public.referring_attorney_contacts FOR SELECT
  USING (id = public.get_current_user_attorney_contact());

-- ---------------------------------------------------------------------
-- 4. Narrow appointments/expert_reports/claimants for BRIDGED external
--    portal sessions only. Native/old-portal referring-attorney logins
--    (is_external_portal_user IS NOT true) keep their existing
--    firm-level access untouched — this migration only ever removes
--    the firm-level branch for is_external_portal_user = true rows.
-- ---------------------------------------------------------------------

-- appointments -------------------------------------------------------
DROP POLICY IF EXISTS "Users can view appointments from their referring attorney" ON public.appointments;
CREATE POLICY "Users can view appointments from their referring attorney"
ON public.appointments FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
  OR (
    assigned_attorney_contact_id IS NOT NULL
    AND assigned_attorney_contact_id = get_current_user_attorney_contact()
  )
);

-- expert_reports -------------------------------------------------------
DROP POLICY IF EXISTS "Users can view expert reports from their referring attorney" ON public.expert_reports;
CREATE POLICY "Users can view expert reports from their referring attorney"
ON public.expert_reports FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.id = expert_reports.appointment_id
    AND a.deleted_at IS NULL
    AND (
      (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        a.assigned_attorney_contact_id IS NOT NULL
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
));

-- claimants ------------------------------------------------------------
-- Claimants don't carry an individual-attorney column of their own —
-- a claimant's case ownership is determined by their appointment(s),
-- so this checks via EXISTS against the same assignment instead of
-- duplicating the concept onto claimants.
DROP POLICY IF EXISTS "Users can view claimants based on role" ON public.claimants;
CREATE POLICY "Users can view claimants based on role"
ON public.claimants
FOR SELECT
TO authenticated
USING (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
  OR (
    get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.claimant_id = claimants.id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
  )
);

COMMENT ON TABLE public.referring_attorney_contacts IS
  'Phase 12: the individual person at a referring firm a case is actually assigned to. Appointment Engine remains the single source of truth — the External Portal reads appointments.assigned_attorney_contact_id directly via RLS, no separate copy.';
COMMENT ON COLUMN public.appointments.assigned_attorney_contact_id IS
  'Phase 12: which individual referring_attorney_contacts row this case belongs to. NULL means unassigned — such appointments are intentionally invisible to bridged External Portal attorney sessions until an admin/staff member assigns them in the Appointment Engine.';

-- ---------------------------------------------------------------------
-- 5. Backfill — confirmed zero-ambiguity case only.
--    Per live-data audit (2026-08-19): exactly one active attorney
--    portal account exists (Nompumza Attorneys /
--    boshomane@kutlwanoassociate.com), and it is the ONLY portal
--    account linked to its firm (other_accounts_same_firm = 0). With
--    no competing individual on record for that firm, the account's
--    own name/email — already captured in external_portal_accounts —
--    is the only value consistent with everything the system
--    currently knows, so this is filling in known identity, not
--    guessing between candidates. No other firm is touched: every
--    other firm either has no linked account yet, or (per the audit
--    query) would need a human decision this migration cannot make.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_account RECORD;
  v_contact_id UUID;
BEGIN
  SELECT id, full_name, email, referring_attorney_id
  INTO v_account
  FROM public.external_portal_accounts
  WHERE portal_type = 'attorney'
    AND deleted_at IS NULL
    AND email = 'boshomane@kutlwanoassociate.com';

  IF v_account.id IS NOT NULL AND v_account.referring_attorney_id IS NOT NULL THEN
    INSERT INTO public.referring_attorney_contacts (referring_attorney_id, full_name, email)
    VALUES (v_account.referring_attorney_id, v_account.full_name, v_account.email)
    ON CONFLICT (referring_attorney_id, lower(email)) WHERE email IS NOT NULL AND is_active
    DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO v_contact_id;

    IF v_contact_id IS NULL THEN
      SELECT id INTO v_contact_id
      FROM public.referring_attorney_contacts
      WHERE referring_attorney_id = v_account.referring_attorney_id
        AND lower(email) = lower(v_account.email)
        AND is_active
      LIMIT 1;
    END IF;

    UPDATE public.external_portal_accounts
    SET assigned_attorney_contact_id = v_contact_id
    WHERE id = v_account.id;

    -- Also sync the live bridged profile immediately, so the account
    -- keeps working without waiting for its next login.
    UPDATE public.profiles p
    SET attorney_contact_id = v_contact_id
    FROM public.external_portal_accounts epa
    WHERE epa.id = v_account.id
      AND p.email = epa.email
      AND p.is_external_portal_user = true;

    -- Assign every existing, non-deleted appointment currently
    -- attributed to this firm to that same sole contact. Safe only
    -- because other_accounts_same_firm = 0 confirmed no competing
    -- individual is on record for this firm.
    UPDATE public.appointments
    SET assigned_attorney_contact_id = v_contact_id
    WHERE referring_attorney_id = v_account.referring_attorney_id
      AND deleted_at IS NULL
      AND assigned_attorney_contact_id IS NULL;
  END IF;
END $$;

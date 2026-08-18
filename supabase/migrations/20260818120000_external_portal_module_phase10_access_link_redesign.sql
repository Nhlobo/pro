-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 10
-- Access Links redesign: usage-ranked attorney/expert selection,
-- email history, and per-link "sent to" tracking.
--
-- SAFE TO RUN AGAINST THE CURRENT DATABASE STATE.
-- Nothing here is destructive:
--   * external_portal_account_emails ALREADY EXISTS (0 rows) — this
--     migration uses CREATE TABLE IF NOT EXISTS and only adds
--     indexes/policies/grants that are individually guarded, so it is
--     a no-op on the table shape itself if columns already match.
--   * external_portal_access_links gets one new nullable column via
--     ADD COLUMN IF NOT EXISTS.
--   * No existing row is updated, no existing object is dropped, the
--     old portal / access-code tables are not touched.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. external_portal_access_links.sent_to_email
--    Records which address a specific link was actually sent to, so
--    that later changing the account's current email doesn't rewrite
--    history. Nullable because links generated before this migration
--    (there should be none, post-reset) have no recorded value.
-- ---------------------------------------------------------------------

ALTER TABLE public.external_portal_access_links
  ADD COLUMN IF NOT EXISTS sent_to_email TEXT;

COMMENT ON COLUMN public.external_portal_access_links.sent_to_email IS
  'The email address this specific link was emailed to at generation time. Independent of external_portal_accounts.email, which may change later.';

-- ---------------------------------------------------------------------
-- 2. external_portal_account_emails
--    Formalizing the table that already exists live (confirmed 0 rows,
--    columns: id, account_id, email, is_current, created_by,
--    created_at). CREATE TABLE IF NOT EXISTS makes this safe to run
--    whether or not the table is already present.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_portal_account_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lowercase-normalized, matching the CHECK already used on
-- external_portal_accounts.email so history entries are comparable.
DO $$ BEGIN
  ALTER TABLE public.external_portal_account_emails
    ADD CONSTRAINT external_portal_account_emails_lower_chk CHECK (email = lower(email));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Exactly one "current" email per account.
CREATE UNIQUE INDEX IF NOT EXISTS external_portal_account_emails_current_uq
  ON public.external_portal_account_emails (account_id)
  WHERE is_current;

-- One history row per (account, email) — lets the admin-links function
-- use a single UPSERT (ON CONFLICT account_id, email) to either insert
-- a genuinely new address or re-mark a previously-used one as current
-- again, instead of accumulating duplicate rows for the same address.
DO $$ BEGIN
  ALTER TABLE public.external_portal_account_emails
    ADD CONSTRAINT external_portal_account_emails_account_email_uq UNIQUE (account_id, email);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS external_portal_account_emails_account_idx
  ON public.external_portal_account_emails (account_id);

CREATE INDEX IF NOT EXISTS external_portal_account_emails_email_idx
  ON public.external_portal_account_emails (account_id, email);

ALTER TABLE public.external_portal_account_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage external portal account emails"
    ON public.external_portal_account_emails FOR ALL
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

REVOKE ALL ON public.external_portal_account_emails FROM anon;

COMMENT ON TABLE public.external_portal_account_emails IS
  'External Portal Module (Phase 10): full history of email addresses ever used for a given external_portal_accounts row. is_current marks the address that currently matches external_portal_accounts.email.';

-- ---------------------------------------------------------------------
-- 3. Backfill: every existing account gets its current email recorded
--    as its first history row, if it doesn't have one yet. Safe/no-op
--    if external_portal_accounts is empty (expected, post-reset) or if
--    a row already exists for that account.
-- ---------------------------------------------------------------------

INSERT INTO public.external_portal_account_emails (account_id, email, is_current, created_by, created_at)
SELECT epa.id, epa.email, true, epa.created_by, epa.created_at
FROM public.external_portal_accounts epa
WHERE NOT EXISTS (
  SELECT 1 FROM public.external_portal_account_emails e WHERE e.account_id = epa.id
);

-- ---------------------------------------------------------------------
-- 4. Usage ranking — Referring Attorneys
--    Most-used first. "Usage" = non-deleted, non-cancelled
--    appointments (confirmed business definition). System/placeholder
--    attorney rows (is_system_company) are intentionally INCLUDED
--    (confirmed: show everyone). SECURITY DEFINER + admin check so
--    this can be called directly via RPC from the admin client
--    without needing a new Edge Function.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.external_portal_referring_attorneys_by_usage()
RETURNS TABLE (
  id UUID,
  name TEXT,
  contact_person TEXT,
  email TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    ra.id,
    ra.name,
    ra.contact_person,
    ra.email,
    count(a.id) AS usage_count
  FROM public.referring_attorneys ra
  LEFT JOIN public.appointments a
    ON a.referring_attorney_id = ra.id
    AND a.deleted_at IS NULL
    AND a.case_status IS DISTINCT FROM 'cancelled'
  GROUP BY ra.id, ra.name, ra.contact_person, ra.email
  ORDER BY usage_count DESC, ra.name ASC;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Usage ranking — Medical Experts
--    Same definition of "usage" as attorneys, for consistency.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.external_portal_medical_experts_by_usage()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    me.id,
    me.first_name,
    me.last_name,
    me.email,
    count(a.id) AS usage_count
  FROM public.medical_experts me
  LEFT JOIN public.appointments a
    ON a.expert_id = me.id
    AND a.deleted_at IS NULL
    AND a.case_status IS DISTINCT FROM 'cancelled'
  GROUP BY me.id, me.first_name, me.last_name, me.email
  ORDER BY usage_count DESC, me.last_name ASC, me.first_name ASC;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Index to support the expert-usage ranking query. Attorneys
--    already have idx_appointments_attorney_status; experts have no
--    equivalent index on (expert_id, case_status).
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_appointments_expert_status
  ON public.appointments (expert_id, case_status);

-- ---------------------------------------------------------------------
-- 7. Grants — functions are SECURITY DEFINER with their own has_role
--    check, but must still be callable via RPC by authenticated staff.
-- ---------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.external_portal_referring_attorneys_by_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.external_portal_medical_experts_by_usage() TO authenticated;

REVOKE ALL ON FUNCTION public.external_portal_referring_attorneys_by_usage() FROM anon;
REVOKE ALL ON FUNCTION public.external_portal_medical_experts_by_usage() FROM anon;

-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 16
-- Fix get_current_user_external_portal_account_id() for multi-individual firms.
--
-- WHY: this function (Phase 11) resolves "which external_portal_accounts
-- row belongs to the currently bridged session" by matching on
-- profiles.referring_attorney_id — the FIRM. Phase 12 already
-- established that firm-level matching is not good enough to identify
-- one specific person: two different attorneys at the same firm, each
-- with their own portal account, both resolve
-- get_current_user_referring_attorney() to the same firm id. The
-- function's `LIMIT 1` with no ordering means it non-deterministically
-- returns ONE of those accounts' ids for BOTH people's sessions —
-- whichever row Postgres happens to return first.
--
-- This function is not currently reachable from any live UI (its only
-- callers were the Messages feature, removed in Phase 13), so this is
-- not an active data leak today. Fixing it now anyway: it is exactly
-- the kind of dangling, half-migrated identity helper that silently
-- reintroduces the Phase 12 bug the moment anything (frontend or a
-- future migration) starts relying on it again — which the frontend
-- hook already sitting in the repo (useMyExternalPortalAccountId) says
-- was clearly the intent.
--
-- Fix: match on the account's own email against the bridged profile's
-- own email instead of re-deriving identity through the firm. This is
-- unambiguous — external_portal_accounts_email_active_uq already
-- guarantees at most one active row per (portal_type, email) — and
-- needs no knowledge of attorney-vs-expert internals, so it stays
-- correct even if a third portal_type is ever added.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_external_portal_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT epa.id
  FROM public.external_portal_accounts epa
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE epa.deleted_at IS NULL
    AND COALESCE(p.is_external_portal_user, false)
    AND lower(epa.email) = lower(p.email)
    AND (
      (epa.portal_type = 'attorney' AND p.role = 'referring_attorney')
      OR (epa.portal_type = 'expert' AND p.role = 'medical_expert')
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_current_user_external_portal_account_id() IS
  'Phase 16: resolves the external_portal_accounts row for the currently bridged portal session by matching the account''s own email against the bridged profile''s own email (unique per portal_type), not by re-deriving identity through the shared firm id — which could not tell two individual attorneys at the same firm apart. Returns NULL for staff / non-bridged sessions.';

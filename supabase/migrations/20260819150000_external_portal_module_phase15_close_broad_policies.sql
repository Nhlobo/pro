-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 15
--
-- Response to an explicit ask: check for a broad permissive policy
-- like `USING (auth.uid() IS NOT NULL)` that silently overrides every
-- other policy on a table (Postgres ORs permissive policies together,
-- so one blanket policy defeats every narrower one alongside it).
--
-- Found two real, live, pre-existing ones — NOT introduced by this
-- module, but they directly undermine the isolation work done in
-- Phases 12–14, so they have to be closed for that work to mean
-- anything:
--
--  1. `documents` — "Block anonymous access to documents" (created
--     20250822152051) is `FOR ALL USING (auth.uid() IS NOT NULL)`.
--     Despite its name, this is a PERMISSIVE policy (Postgres's
--     default), not a restrictive one — so instead of blocking
--     anonymous access, it grants every operation to every
--     authenticated user, unconditionally. It was never dropped.
--     Every fix made to `documents` in Phase 13/14 has been sitting
--     next to this the whole time, which — until this migration —
--     made all of it moot: any signed-in user, staff or external,
--     could already read/write/delete any document.
--
--  2. `referring_attorneys` — the exact same mistake, same day,
--     different table: "Block anonymous access to law firms"
--     (20250822130637), `FOR ALL USING (auth.uid() IS NOT NULL)`,
--     added immediately after a correctly-scoped "Users can view own
--     law firm only" policy — and immediately undoing it the same
--     way. Any authenticated user can currently read/modify/delete
--     the entire firm directory.
--
-- (expert_reports had an identical debug-only policy from
-- 20250816191129, but it was already correctly dropped and replaced
-- two days later in 20250818090121 — verified, not touched here.)
--
-- These are dropped outright, not narrowed — the correctly-scoped
-- policies already sitting alongside them (per-firm/per-contact for
-- documents; "Users can view own law firm only" + admin policies for
-- referring_attorneys) are sufficient on their own once the blanket
-- policy is gone.
-- =====================================================================

DROP POLICY IF EXISTS "Block anonymous access to documents" ON public.documents;
DROP POLICY IF EXISTS "Block anonymous access to law firms" ON public.referring_attorneys;

-- ---------------------------------------------------------------------
-- expert_payments — had no expert-facing SELECT policy at all (broken/
-- empty for experts, not a leak) and its existing attorney-facing
-- SELECT/INSERT/UPDATE were firm-level only, with no
-- is_external_portal_user narrowing — meaning a bridged attorney
-- session could read AND write payment records for their whole firm,
-- not just their own assigned cases, unlike everywhere else already
-- fixed. Brought in line with the same pattern.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view expert payments from their referring attorney" ON public.expert_payments;
CREATE POLICY "Users can view expert payments from their referring attorney"
ON public.expert_payments
FOR SELECT
TO authenticated
USING (
  (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_payments.appointment_id
        AND a.referring_attorney_id = get_current_user_referring_attorney()
    )
  )
  OR (
    get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_payments.appointment_id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
  )
  OR (
    get_current_user_expert_id() IS NOT NULL
    AND expert_payments.expert_id = get_current_user_expert_id()
  )
);

DROP POLICY IF EXISTS "Users can create expert payments for their referring attorney" ON public.expert_payments;
CREATE POLICY "Users can create expert payments for their referring attorney"
ON public.expert_payments
FOR INSERT
TO authenticated
WITH CHECK (
  recorded_by = auth.uid()
  AND (
    is_system_admin()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR (
      NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = expert_payments.appointment_id
          AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
    )
    OR (
      get_current_user_attorney_contact() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = expert_payments.appointment_id
          AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can update expert payments from their referring attorney" ON public.expert_payments;
CREATE POLICY "Users can update expert payments from their referring attorney"
ON public.expert_payments
FOR UPDATE
TO authenticated
USING (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_payments.appointment_id
        AND a.referring_attorney_id = get_current_user_referring_attorney()
    )
  )
  OR (
    get_current_user_attorney_contact() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = expert_payments.appointment_id
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
    )
  )
);

-- ---------------------------------------------------------------------
-- Also found, NOT fixed here — flagging rather than expanding scope
-- further without confirmation:
--
-- `medical_experts` has "Allow authenticated users only" (created
-- 20250916193134), `FOR ALL USING (auth.uid() IS NOT NULL)`. Same
-- shape of bug, but on the expert directory/profile table itself —
-- not case data, but it does mean any authenticated user (any
-- attorney, any bridged session) can currently read the full roster
-- of every medical expert, and per FOR ALL, INSERT/UPDATE/DELETE too.
-- This predates the External Portal entirely and affects the whole
-- application (internal staff pages included), so narrowing it needs
-- your confirmation of what internal staff/native portal access is
-- actually supposed to look like before I touch it, rather than a
-- guess bundled into this migration.
-- ---------------------------------------------------------------------

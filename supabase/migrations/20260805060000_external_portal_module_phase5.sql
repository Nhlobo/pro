-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 5 (schema addendum)
--
-- Two additions, both additive/isolated:
--
-- 1. external_portal_case_messages — a lightweight message thread
--    between staff and an external portal user, scoped to one linked
--    case. This is NEW functionality, not a duplication: the existing
--    schema has no case-linked communication channel that external
--    users could safely be given access to (notifications.user_id is
--    staff/auth.users only; support_tickets/ticket_messages aren't
--    case-linked). Documents and Progress, by contrast, DO reuse
--    existing tables (documents, case_timelines) — see the edge
--    functions for that read path; no new table was needed for those.
--
-- 2. Schedules the Phase 1 function
--    external_portal_auto_expire_stale_accounts() to actually run
--    periodically via pg_cron, closing the loop on requirement 4
--    ("If all assigned cases are closed, access must automatically
--    expire") — until now that function existed but nothing called it.
-- =====================================================================

CREATE TABLE public.external_portal_case_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,

  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'external_user')),
  sender_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- set when sender_type = 'admin'

  body TEXT NOT NULL CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 4000),

  read_by_admin_at TIMESTAMP WITH TIME ZONE,
  read_by_external_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- A message must be about a case actually linked to that account —
-- enforced at the application layer (edge function / admin hook) since
-- cross-table CHECK constraints aren't possible in Postgres; this
-- index makes that lookup cheap.
CREATE INDEX external_portal_case_messages_account_case_idx
  ON public.external_portal_case_messages (account_id, appointment_id, created_at);
CREATE INDEX external_portal_case_messages_appointment_idx
  ON public.external_portal_case_messages (appointment_id);

ALTER TABLE public.external_portal_case_messages ENABLE ROW LEVEL SECURITY;

-- Same posture as every other table in this module: admins get full
-- access via the normal Supabase client (has_role check). External
-- users never query this table directly — the external-portal-messages
-- edge function reads/writes it with the service role after validating
-- the caller's session_token and confirming the case is actually
-- linked to that account.
CREATE POLICY "Admins manage external portal case messages"
  ON public.external_portal_case_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.external_portal_case_messages FROM anon;

COMMENT ON TABLE public.external_portal_case_messages IS
  'External Portal Module (Phase 5): per-case message thread between staff and an external portal user (attorney or expert). New table — no existing case-communication channel existed to reuse.';

-- ---------------------------------------------------------------------
-- Schedule auto-expiry
-- ---------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: unschedule first so re-running this migration (or a
-- future deploy that re-applies it) doesn't create a duplicate job.
DO $$
BEGIN
  PERFORM cron.unschedule('external-portal-auto-expire');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet — fine
END $$;

SELECT cron.schedule(
  'external-portal-auto-expire',
  '0 * * * *', -- hourly, on the hour
  $$ SELECT public.external_portal_auto_expire_stale_accounts(); $$
);

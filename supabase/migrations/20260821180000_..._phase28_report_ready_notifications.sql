-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 28
-- The single, highest-value notification trigger: an attorney is
-- actually notified when their report becomes available.
--
-- CONTEXT: traced the full notification lifecycle end to end. The
-- send-notification edge function fully supports 'report_available' /
-- 'document_missing' / 'appointment_reminder' notification types (has
-- email templates, icon logic, everything) — but nothing in the entire
-- codebase ever calls it with those types. The only real callers send
-- 'general'-type notifications for the sales/pitch pipeline. This
-- means an attorney has never once received an in-app or email
-- notification for a case-lifecycle event, regardless of what happens
-- to their case.
--
-- The attorney-portal frontend (AttorneyNotifications.tsx) already has
-- full, working support for a `category = 'report_ready'` notification
-- — its own dedicated "Reports" tab, icon, and count — it has simply
-- never received one, because nothing writes it.
--
-- SCOPE: this migration wires up exactly one trigger — the one this
-- entire session's work has been building toward: when a report
-- document goes from staff-review-pending to attorney-visible
-- (documents.is_visible_to_attorney flips false -> true, for
-- document_type = 'Expert Report'), insert a real notifications row
-- for every attorney who should see it. A database trigger (not a
-- frontend call) is used deliberately — it fires no matter which UI
-- staff use to approve a document (AdminDocumentVault.tsx today, or
-- anything else later), rather than depending on every future call
-- site remembering to notify.
--
-- Two other event types (document_missing, appointment_reminder) are
-- NOT wired up here — they need business rules this migration
-- shouldn't invent unilaterally (what counts as "missing", what
-- lead time counts as a "reminder"). Flagged separately, not built
-- silently.
--
-- WHO GETS NOTIFIED, and why this exact set: mirrors the same
-- firm/individual visibility logic used everywhere else in this
-- module, not a new rule —
--   - any native (pre-portal) attorney profile for that firm
--   - any bridged 'firm'-scoped portal account for that firm
--   - any bridged 'individual'-scoped portal account, ONLY if the
--     report's case is actually assigned to their specific contact
--     (matches Phase 20's access rule exactly — an individual-scoped
--     attorney shouldn't be notified about a case they can't even see)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_attorney_on_report_visible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment RECORD;
  v_claimant_name text;
  v_message text;
BEGIN
  -- Only fire on the specific transition this is about: a report
  -- document becoming attorney-visible for the first time.
  IF NEW.document_type IS DISTINCT FROM 'Expert Report' THEN
    RETURN NEW;
  END IF;
  IF NOT (COALESCE(NEW.is_visible_to_attorney, false) = true AND COALESCE(OLD.is_visible_to_attorney, false) = false) THEN
    RETURN NEW;
  END IF;
  IF NEW.appointment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.id, a.referring_attorney_id, a.assigned_attorney_contact_id, a.claimant_id
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = NEW.appointment_id;

  IF v_appointment.referring_attorney_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT trim(concat_ws(' ', c.first_name, c.last_name))
  INTO v_claimant_name
  FROM public.claimants c
  WHERE c.id = v_appointment.claimant_id;

  v_message := 'The medico-legal report for ' || COALESCE(NULLIF(v_claimant_name, ''), 'your claimant') || ' is now available to view and download.';

  INSERT INTO public.notifications (user_id, title, message, type, category, related_record_id, related_table)
  SELECT DISTINCT p.id, 'Report Available', v_message, 'report_ready', 'report_ready', NEW.id, 'documents'
  FROM public.profiles p
  LEFT JOIN public.external_portal_accounts epa
    ON epa.portal_type = 'attorney'
    AND epa.deleted_at IS NULL
    AND lower(epa.email) = lower(p.email)
  WHERE p.referring_attorney_id = v_appointment.referring_attorney_id
    AND (
      -- native (pre-portal) attorney login — always relevant for its own firm
      NOT COALESCE(p.is_external_portal_user, false)
      -- bridged firm-scoped account — sees every case for the firm
      OR (COALESCE(p.is_external_portal_user, false) AND epa.account_scope = 'firm')
      -- bridged individual-scoped account — only if this exact case is theirs
      OR (
        COALESCE(p.is_external_portal_user, false)
        AND epa.account_scope = 'individual'
        AND p.attorney_contact_id IS NOT NULL
        AND p.attorney_contact_id = v_appointment.assigned_attorney_contact_id
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_attorney_on_report_visible ON public.documents;
CREATE TRIGGER trg_notify_attorney_on_report_visible
AFTER UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.notify_attorney_on_report_visible();

COMMENT ON FUNCTION public.notify_attorney_on_report_visible() IS
  'Phase 28: fires when a staff review action makes an expert report visible to the attorney (is_visible_to_attorney false -> true). Inserts a real notifications row, closing the previously-confirmed gap where no case-lifecycle notification had ever actually been sent to a portal attorney. Deliberately scoped to this one event only — document_missing and appointment_reminder need business rules this migration should not invent unilaterally.';

-- =====================================================================
-- DOCUMENTATION ONLY. Not executed. For manual review before applying.
--
-- Purpose: this repository had NO tracked migration for the internal
-- invoice pipeline — every object below was created directly against
-- the live database, outside version control. This file exists to
-- close that gap by recording, as a reviewable migration, exactly what
-- was confirmed live via direct SQL inspection (information_schema,
-- pg_proc/pg_get_functiondef, pg_trigger) on 2026-08-15.
--
-- This file changes NOTHING about live behavior:
--   - CREATE TABLE IF NOT EXISTS is a no-op against tables that already
--     exist with these columns (confirmed live).
--   - CREATE OR REPLACE FUNCTION reproduces the live function bodies
--     verbatim, byte-for-byte as returned by pg_get_functiondef() —
--     nothing here was rewritten, "cleaned up", or adapted to fit the
--     repository. Applying this to the live database changes nothing
--     about how these functions behave.
--   - The trigger is (re)created with DROP TRIGGER IF EXISTS + CREATE
--     TRIGGER using the exact timing/event/function confirmed live.
--
-- IMPORTANT — THIS FILE IS DELIBERATELY INCOMPLETE. It captures only
-- what was directly verified through live SQL. The following are
-- NOT captured here, are NOT invented, and must not be assumed correct
-- if this file is ever used to rebuild the schema from scratch:
--
--   1. internal_invoices.invoice_number is generated from
--      nextval('internal_invoices_number_seq') inside
--      reconcile_internal_invoices() below. That sequence's own
--      definition (start value, increment, current value, ownership)
--      was never queried live and is NOT created by this file.
--   2. Primary keys, foreign key constraints, and indexes (including
--      the partial unique index that handle_report_delivery_billing()'s
--      own code comment refers to as "the structural guarantee" behind
--      idempotent delivery-queue enqueueing) were never enumerated via
--      pg_constraint/pg_indexes and are NOT recreated here. Without
--      that index, the idempotent-enqueue behavior this pipeline
--      depends on is not actually enforced by this file alone.
--   3. Row-Level Security policies on all three tables were never
--      queried live and are NOT recreated here.
--   4. internal_invoice_events and internal_sage_queue are written to
--      by reconcile_internal_invoices() below (see its body) but their
--      table definitions were never queried live via information_schema.
--      Only the columns actually referenced in the function body are
--      known (internal_invoice_events: internal_invoice_id, event_type,
--      new_values, description; internal_sage_queue: internal_invoice_id
--      at minimum, plus id/status/attempts/last_error/claimed_at/
--      processed_at/created_at per supabase/functions/internal-sage-
--      processor/index.ts's QueueRow type — that type is app-code, not
--      a confirmed live schema). Neither table is created or altered by
--      this file.
--   5. The pg_cron job (jobname: internal-invoice-delivery-processor-
--      hourly, jobid 27 as of verification, schedule '5 * * * *') and
--      the internal-invoice-delivery-processor edge function it calls
--      are both confirmed live and active, but neither is created by
--      this file, per explicit instruction not to touch cron scheduling
--      or the deployed processor. The edge function's source code was
--      never located in this repository and is not reproduced anywhere.
--
-- Confirmed live via direct SQL query on 2026-08-15 (not inferred from
-- this repository's application code):
--   - Table columns: internal_invoices, internal_invoice_delivery_queue,
--     internal_invoice_email_log (information_schema.columns)
--   - Trigger: trigger_report_delivery_billing on report_deliveries,
--     AFTER INSERT, calls handle_report_delivery_billing(), enabled
--   - Function bodies: handle_report_delivery_billing(),
--     reconcile_internal_invoices(p_dry_run boolean) — via
--     pg_get_functiondef()
--   - internal_invoice_events count (461, all event_type='created') and
--     zero duplicate invoice_number values, confirming no other process
--     bypasses reconcile_internal_invoices() to write internal_invoices
--     directly.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tables (columns only — see caveat #2/#3 above: no PK/FK/index/RLS
-- captured). IF NOT EXISTS makes this a no-op against the live database.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.internal_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  claimant_id uuid,
  expert_id uuid,
  referring_attorney_id uuid,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  amount numeric NOT NULL,
  vat_amount numeric NOT NULL,
  total_amount numeric NOT NULL,
  invoice_date timestamp with time zone NOT NULL DEFAULT now(),
  due_date timestamp with time zone,
  voided_at timestamp with time zone,
  void_reason text,
  reactivated_at timestamp with time zone,
  reactivation_count integer NOT NULL DEFAULT 0,
  needs_review_reason text,
  needs_review_flagged_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.internal_invoice_delivery_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  internal_invoice_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamp with time zone,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.internal_invoice_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  internal_invoice_id uuid NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  resend_message_id text,
  recipient_email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------
-- Functions — reproduced verbatim from pg_get_functiondef() on the
-- live database. Not modified in any way.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_report_delivery_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appointment_id uuid;
  v_internal_invoice_id uuid;
BEGIN
  -- Existing, authoritative, unmodified reconciliation. This is the
  -- ONLY invoice-creation/VAT/amount logic this trigger touches.
  PERFORM public.reconcile_internal_invoices(false);

  -- Resolve which appointment this delivered report belongs to.
  SELECT er.appointment_id INTO v_appointment_id
  FROM public.expert_reports er
  WHERE er.id = NEW.expert_report_id;

  IF v_appointment_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the active internal_invoices row reconciliation just ensured
  -- exists for this appointment. Read-only against internal_invoices.
  SELECT id INTO v_internal_invoice_id
  FROM public.internal_invoices
  WHERE appointment_id = v_appointment_id
    AND status = 'active'
  ORDER BY invoice_date DESC, id DESC
  LIMIT 1;

  -- No valid invoice: do not queue anything, do not send anything.
  IF v_internal_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotent enqueue. The partial unique index above is the
  -- structural guarantee; this WHERE NOT EXISTS just avoids a
  -- needless insert attempt in the common case.
  INSERT INTO public.internal_invoice_delivery_queue (internal_invoice_id, status)
  SELECT v_internal_invoice_id, 'pending'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.internal_invoice_delivery_queue q
    WHERE q.internal_invoice_id = v_internal_invoice_id
      AND q.status IN ('pending', 'processing', 'success')
  );

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.reconcile_internal_invoices(p_dry_run boolean DEFAULT true)
 RETURNS TABLE(appointment_id uuid, action text, current_service_fee numeric, matched_invoice_id uuid, matched_invoice_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column

DECLARE
  r record;
  v_vat numeric(12,2);
  v_excl numeric(12,2);
  v_due_date timestamptz;
  v_invoice_number text;
  v_new_id uuid;
BEGIN

  -- Prevent concurrent reconciliation runs
  IF NOT pg_try_advisory_xact_lock(
    hashtext('reconcile_internal_invoices')
  ) THEN
    RETURN;
  END IF;

  -- ============================================================
  -- CREATE MISSING INTERNAL INVOICES
  -- ============================================================
  FOR r IN
    SELECT
      a.id AS appt_id,
      a.service_fee,
      a.claimant_id,
      a.expert_id,
      a.referring_attorney_id,
      a.payment_terms
    FROM public.appointments AS a
    WHERE a.case_status = 'assessed'
      AND a.deleted_at IS NULL
      AND a.service_fee IS NOT NULL
      AND a.service_fee > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.internal_invoices AS existing_invoice
        WHERE existing_invoice.appointment_id = a.id
      )
  LOOP

    IF p_dry_run THEN
      appointment_id := r.appt_id;
      action := 'would_create';
      current_service_fee := r.service_fee;
      matched_invoice_id := NULL;
      matched_invoice_total := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Service fee is VAT inclusive at 15%
    v_vat := r.service_fee - (r.service_fee / 1.15);
    v_excl := r.service_fee - v_vat;

    v_due_date :=
      CASE
        WHEN lower(trim(coalesce(r.payment_terms, ''))) = 'immediate'
        THEN now()
        ELSE NULL
      END;

    v_invoice_number :=
      'INV-' ||
      EXTRACT(YEAR FROM now())::text ||
      '-' ||
      LPAD(
        nextval('internal_invoices_number_seq')::text,
        6,
        '0'
      );

    v_new_id := NULL;

    INSERT INTO public.internal_invoices AS invoice_row
    (
      appointment_id,
      claimant_id,
      expert_id,
      referring_attorney_id,
      invoice_number,
      status,
      amount,
      vat_amount,
      total_amount,
      invoice_date,
      due_date
    )
    VALUES
    (
      r.appt_id,
      r.claimant_id,
      r.expert_id,
      r.referring_attorney_id,
      v_invoice_number,
      'active',
      v_excl,
      v_vat,
      r.service_fee,
      now(),
      v_due_date
    )
    ON CONFLICT (appointment_id) DO NOTHING
    RETURNING invoice_row.id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN

      INSERT INTO public.internal_invoice_events
      (
        internal_invoice_id,
        event_type,
        new_values,
        description
      )
      VALUES
      (
        v_new_id,
        'created',
        jsonb_build_object(
          'invoice_number', v_invoice_number,
          'total_amount', r.service_fee
        ),
        'Created by reconcile_internal_invoices()'
      );

      INSERT INTO public.internal_sage_queue
      (
        internal_invoice_id
      )
      VALUES
      (
        v_new_id
      )
      ON CONFLICT (internal_invoice_id) DO NOTHING;

      appointment_id := r.appt_id;
      action := 'created';
      current_service_fee := r.service_fee;
      matched_invoice_id := v_new_id;
      matched_invoice_total := r.service_fee;

      RETURN NEXT;
    END IF;

  END LOOP;


  -- ============================================================
  -- VOID ACTIVE INVOICES FOR CANCELLED / DELETED APPOINTMENTS
  -- ============================================================
  FOR r IN
    SELECT
      a.id AS appt_id,
      a.service_fee,
      ii.id AS invoice_id,
      ii.total_amount
    FROM public.appointments AS a
    JOIN public.internal_invoices AS ii
      ON ii.appointment_id = a.id
     AND ii.status = 'active'
    WHERE a.case_status = 'cancelled'
       OR a.deleted_at IS NOT NULL
  LOOP

    IF p_dry_run THEN
      appointment_id := r.appt_id;
      action := 'would_void';
      current_service_fee := r.service_fee;
      matched_invoice_id := r.invoice_id;
      matched_invoice_total := r.total_amount;
      RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.internal_invoices AS invoice_row
    SET
      status = 'void',
      voided_at = now(),
      void_reason = 'appointment cancelled or deleted',
      updated_at = now()
    WHERE invoice_row.id = r.invoice_id;

    INSERT INTO public.internal_invoice_events
    (
      internal_invoice_id,
      event_type,
      new_values,
      description
    )
    VALUES
    (
      r.invoice_id,
      'voided',
      jsonb_build_object('status', 'void'),
      'Voided by reconcile_internal_invoices(): appointment cancelled or deleted'
    );

    appointment_id := r.appt_id;
    action := 'voided';
    current_service_fee := r.service_fee;
    matched_invoice_id := r.invoice_id;
    matched_invoice_total := r.total_amount;

    RETURN NEXT;

  END LOOP;


  -- ============================================================
  -- REACTIVATE OR FLAG FOR REVIEW
  -- ============================================================
  FOR r IN
    SELECT
      a.id AS appt_id,
      a.service_fee,
      ii.id AS invoice_id,
      ii.total_amount,
      ii.reactivation_count
    FROM public.appointments AS a
    JOIN public.internal_invoices AS ii
      ON ii.appointment_id = a.id
     AND ii.status = 'void'
    WHERE a.case_status = 'assessed'
      AND a.deleted_at IS NULL
      AND a.service_fee IS NOT NULL
      AND a.service_fee > 0
  LOOP

    IF r.service_fee = r.total_amount THEN

      IF p_dry_run THEN
        appointment_id := r.appt_id;
        action := 'would_reactivate';
        current_service_fee := r.service_fee;
        matched_invoice_id := r.invoice_id;
        matched_invoice_total := r.total_amount;
        RETURN NEXT;
        CONTINUE;
      END IF;

      UPDATE public.internal_invoices AS invoice_row
      SET
        status = 'active',
        voided_at = NULL,
        void_reason = NULL,
        needs_review_reason = NULL,
        needs_review_flagged_at = NULL,
        reactivated_at = now(),
        reactivation_count =
          COALESCE(invoice_row.reactivation_count, 0) + 1,
        updated_at = now()
      WHERE invoice_row.id = r.invoice_id;

      INSERT INTO public.internal_invoice_events
      (
        internal_invoice_id,
        event_type,
        new_values,
        description
      )
      VALUES
      (
        r.invoice_id,
        'reactivated',
        jsonb_build_object(
          'reactivation_count',
          COALESCE(r.reactivation_count, 0) + 1
        ),
        'Reactivated by reconcile_internal_invoices(): fee unchanged'
      );

      appointment_id := r.appt_id;
      action := 'reactivated';
      current_service_fee := r.service_fee;
      matched_invoice_id := r.invoice_id;
      matched_invoice_total := r.total_amount;

      RETURN NEXT;

    ELSE

      IF p_dry_run THEN
        appointment_id := r.appt_id;
        action := 'would_flag_review';
        current_service_fee := r.service_fee;
        matched_invoice_id := r.invoice_id;
        matched_invoice_total := r.total_amount;
        RETURN NEXT;
        CONTINUE;
      END IF;

      UPDATE public.internal_invoices AS invoice_row
      SET
        status = 'needs_review',
        needs_review_flagged_at = now(),
        needs_review_reason = format(
          'Re-assessed with service_fee %s vs original invoice total %s (%s)',
          r.service_fee,
          r.total_amount,
          r.invoice_id
        ),
        updated_at = now()
      WHERE invoice_row.id = r.invoice_id;

      INSERT INTO public.internal_invoice_events
      (
        internal_invoice_id,
        event_type,
        new_values,
        description
      )
      VALUES
      (
        r.invoice_id,
        'needs_review',
        jsonb_build_object(
          'current_service_fee', r.service_fee,
          'original_total_amount', r.total_amount
        ),
        'Flagged by reconcile_internal_invoices(): fee changed since void'
      );

      appointment_id := r.appt_id;
      action := 'flagged_review';
      current_service_fee := r.service_fee;
      matched_invoice_id := r.invoice_id;
      matched_invoice_total := r.total_amount;

      RETURN NEXT;

    END IF;

  END LOOP;

  RETURN;
END;
$function$;


-- ---------------------------------------------------------------------
-- Trigger — confirmed live: AFTER INSERT on report_deliveries, calls
-- handle_report_delivery_billing(), enabled. DROP + CREATE reproduces
-- this exactly; if applied to a database where it's already identical,
-- this changes nothing.
--
-- Note on FOR EACH ROW: the live query against pg_trigger did not
-- separately confirm row-level vs statement-level. FOR EACH ROW is used
-- here because it is the only option consistent with the confirmed
-- function body, which reads NEW.expert_report_id directly — a
-- statement-level trigger has no NEW record to read. This is a
-- necessary inference from the verified function body, not a guess.
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_report_delivery_billing ON public.report_deliveries;

CREATE TRIGGER trigger_report_delivery_billing
  AFTER INSERT ON public.report_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_report_delivery_billing();

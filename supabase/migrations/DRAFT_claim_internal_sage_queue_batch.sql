-- =====================================================================
-- ADDITIVE ONLY. Not executed. For manual review/execution by you.
--
-- Why this is needed: PostgREST (the Supabase JS client) cannot express
-- `UPDATE ... LIMIT n ... FOR UPDATE SKIP LOCKED` directly — that is the
-- only construct that guarantees two concurrent internal-sage-processor
-- invocations can never claim the same internal_sage_queue row. This one
-- function provides exactly that, and nothing else.
--
-- Does NOT modify: internal_invoices, internal_sage_queue's schema,
-- sageone_invoice_queue, appointments, the existing legacy Sage
-- processor/trigger, or reconcile_internal_invoices(). Creates one new,
-- additive, read+write-on-internal_sage_queue-only function.
-- =====================================================================

CREATE FUNCTION public.claim_internal_sage_queue_batch(p_limit integer)
RETURNS SETOF public.internal_sage_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.internal_sage_queue
  SET status = 'processing', claimed_at = now()
  WHERE id IN (
    SELECT id FROM public.internal_sage_queue
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.claim_internal_sage_queue_batch(integer);

-- ============================================================
-- Attorney POP (Proof of Payment) uploads
--
-- Client requirement: Finance must be able to upload proof of
-- payment for AOD and Short-Term Agreement payments, and both
-- Finance staff and the referring attorney should be able to
-- see uploaded POPs (record keeping is a business advantage).
--
-- payment_pop_attachments already exists in the live database
-- (visible via generated types) but there is no migration file
-- for it in this repo's history, and it has no storage bucket
-- or RLS policies wired up, so it has never actually been
-- usable from the app. This migration reconciles the table
-- (IF NOT EXISTS, so it's a no-op if it's already there),
-- creates the storage bucket, and adds correct RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_pop_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- record_type: 'aod_payment' | 'short_term_payment' | 'expert_payment'
  record_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  payment_reference TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  sageone_transaction_id TEXT,
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_pop_attachments_record
  ON public.payment_pop_attachments (record_type, record_id);

ALTER TABLE public.payment_pop_attachments ENABLE ROW LEVEL SECURITY;

-- Helper: does the current user (admin/employee OR the owning attorney)
-- have access to a given payment_pop_attachments row?
CREATE OR REPLACE FUNCTION public.can_access_payment_pop(_record_type TEXT, _record_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_or_employee() THEN
    RETURN TRUE;
  END IF;

  IF _record_type = 'aod_payment' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.aod_payments ap
      JOIN public.aod_documents ad ON ad.id = ap.aod_document_id
      WHERE ap.id = _record_id
        AND ad.referring_attorney_id = public.get_current_user_referring_attorney()
    );
  ELSIF _record_type = 'short_term_payment' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.short_term_agreement_payments stp
      JOIN public.short_term_agreements sta ON sta.id = stp.agreement_id
      WHERE stp.id = _record_id
        AND sta.referring_attorney_id = public.get_current_user_referring_attorney()
    );
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_payment_pop(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_payment_pop(TEXT, UUID) TO authenticated;

DROP POLICY IF EXISTS "Staff and owning attorney can view payment POPs" ON public.payment_pop_attachments;
CREATE POLICY "Staff and owning attorney can view payment POPs"
  ON public.payment_pop_attachments FOR SELECT
  TO authenticated
  USING (public.can_access_payment_pop(record_type, record_id));

DROP POLICY IF EXISTS "Staff can upload payment POPs" ON public.payment_pop_attachments;
CREATE POLICY "Staff can upload payment POPs"
  ON public.payment_pop_attachments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_employee() AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Staff can update payment POPs" ON public.payment_pop_attachments;
CREATE POLICY "Staff can update payment POPs"
  ON public.payment_pop_attachments FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_employee())
  WITH CHECK (public.is_admin_or_employee());

DROP POLICY IF EXISTS "Staff can delete payment POPs" ON public.payment_pop_attachments;
CREATE POLICY "Staff can delete payment POPs"
  ON public.payment_pop_attachments FOR DELETE
  TO authenticated
  USING (public.is_admin_or_employee());

-- ============================================================
-- Storage bucket for the actual files
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-pop-documents', 'payment-pop-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff can upload payment POP files" ON storage.objects;
CREATE POLICY "Staff can upload payment POP files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-pop-documents' AND public.is_admin_or_employee());

DROP POLICY IF EXISTS "Staff and owning attorney can view payment POP files" ON storage.objects;
CREATE POLICY "Staff and owning attorney can view payment POP files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-pop-documents'
    AND (
      public.is_admin_or_employee()
      OR EXISTS (
        SELECT 1 FROM public.payment_pop_attachments ppa
        WHERE ppa.file_path = storage.objects.name
          AND public.can_access_payment_pop(ppa.record_type, ppa.record_id)
      )
    )
  );

DROP POLICY IF EXISTS "Staff can delete payment POP files" ON storage.objects;
CREATE POLICY "Staff can delete payment POP files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-pop-documents' AND public.is_admin_or_employee());

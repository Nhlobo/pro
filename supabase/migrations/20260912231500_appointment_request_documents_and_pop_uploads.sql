-- Client request (email, 12 Sep 2026, Kutlwano Associates): when an attorney
-- requests a new appointment date, they should be able to attach supporting
-- documents (medical records, instruction letter, summons, etc.) and proof
-- of payment, so staff have what they need to book immediately instead of
-- waiting on a follow-up.
--
-- appointment_requests has no claimant_id/appointment_id yet at this stage
-- (those only exist once a request is approved and synced into a real
-- appointment - see synced_appointment_id), so the generic `documents` table
-- doesn't fit here. This mirrors payment_pop_attachments: a small,
-- purpose-built table keyed off appointment_request_id, with the same
-- ownership-based RLS shape (own-insert, own-read, staff-view-all).
--
-- Note: there's a pre-existing, separate "email request" quick-action on
-- AttorneyAppointments.tsx that drops files into the `documents` bucket
-- under an `appointment-request-attachments/<firm>/...` prefix with no
-- tracking row at all (untyped, unlinked to any request, only mentioned as
-- a raw path string in additional_notes). That's left untouched here - this
-- migration is a proper, separate, reviewable mechanism for the actual
-- "New Appointment Request" page in the attorney portal.

CREATE TABLE public.appointment_request_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_request_id uuid NOT NULL REFERENCES public.appointment_requests(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('medical_record','instruction_letter','summons','other')),
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes integer,
  mime_type text,
  notes text,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.appointment_request_documents IS 'Supporting documents (medical records, instruction letters, summonses, etc.) attached by the referring attorney when submitting an appointment_requests row, before any claimant/appointment record exists.';

CREATE INDEX idx_appointment_request_documents_request_id ON public.appointment_request_documents (appointment_request_id);
CREATE INDEX idx_appointment_request_documents_uploaded_by ON public.appointment_request_documents (uploaded_by);

ALTER TABLE public.appointment_request_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own appointment request documents" ON public.appointment_request_documents
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = (select auth.uid()));
CREATE POLICY "Users read own appointment request documents" ON public.appointment_request_documents
  FOR SELECT TO authenticated USING (uploaded_by = (select auth.uid()));
CREATE POLICY "Staff can view all appointment request documents" ON public.appointment_request_documents
  FOR SELECT TO authenticated USING (is_admin_or_employee());
CREATE POLICY "Staff can delete appointment request documents" ON public.appointment_request_documents
  FOR DELETE TO authenticated USING (is_admin_or_employee());
CREATE POLICY "Admins manage all appointment request documents" ON public.appointment_request_documents
  FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- Dedicated bucket, folder-scoped by uploader (same convention as advisory-documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'appointment-request-documents',
  'appointment-request-documents',
  false,
  52428800,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own appt request docs storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'appointment-request-documents' AND (storage.foldername(name))[1] = (select auth.uid())::text);
CREATE POLICY "Users read own appt request docs storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'appointment-request-documents' AND (storage.foldername(name))[1] = (select auth.uid())::text);
CREATE POLICY "Staff read all appt request docs storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'appointment-request-documents' AND is_admin_or_employee());
CREATE POLICY "Staff delete appt request docs storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'appointment-request-documents' AND is_admin_or_employee());

-- payment_pop_attachments already allows record_type='appointment_request' at
-- the table level, but storage.objects has only ever allowed staff to upload
-- into payment-pop-documents (POP upload has been a Finance/staff-only
-- action until now - the attorney portal has only ever had view access, per
-- PaymentPopUploader.tsx). This narrowly opens upload+read for the
-- appointment_request/* prefix only; every other record type in this bucket
-- (aod_payment, short_term_payment, appointment_payment) keeps staff-only
-- upload, unchanged. Verified via role-simulated transaction before this
-- migration was applied: attorneys can upload/read their own
-- appointment_request/* objects, and are still blocked from every other
-- prefix in this bucket.
CREATE POLICY "Attorneys can upload appointment request POPs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-pop-documents' AND (storage.foldername(name))[1] = 'appointment_request');

CREATE POLICY "Attorneys can view own appointment request POPs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-pop-documents'
    AND (storage.foldername(name))[1] = 'appointment_request'
    AND EXISTS (
      SELECT 1 FROM public.payment_pop_attachments ppa
      WHERE ppa.file_path = objects.name
        AND ppa.record_type = 'appointment_request'
        AND ppa.uploaded_by = (select auth.uid())
    )
  );

ALTER TABLE public.appointment_checklist
  ADD COLUMN transport_required boolean NOT NULL DEFAULT false,
  ADD COLUMN all_documents_received boolean NOT NULL DEFAULT false;
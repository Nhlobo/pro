-- Add explicit linked_appointment_ids array to AOD docs and short-term agreements
ALTER TABLE public.aod_documents
  ADD COLUMN IF NOT EXISTS linked_appointment_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.short_term_agreements
  ADD COLUMN IF NOT EXISTS linked_appointment_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_aod_documents_linked_appointment_ids
  ON public.aod_documents USING GIN (linked_appointment_ids);

CREATE INDEX IF NOT EXISTS idx_short_term_agreements_linked_appointment_ids
  ON public.short_term_agreements USING GIN (linked_appointment_ids);

-- Backfill from existing notes-text markers like "APPOINTMENT:<uuid>" or "Appointment ID: <8-char prefix>"
DO $$
DECLARE
  rec record;
  full_ids uuid[];
BEGIN
  -- AOD documents: extract full UUIDs from "APPOINTMENT:<uuid>" markers
  FOR rec IN SELECT id, notes FROM public.aod_documents WHERE notes IS NOT NULL LOOP
    SELECT COALESCE(array_agg(DISTINCT (m[1])::uuid), '{}')
      INTO full_ids
      FROM regexp_matches(rec.notes, 'APPOINTMENT:([0-9a-fA-F\-]{36})', 'g') m;
    IF array_length(full_ids, 1) > 0 THEN
      UPDATE public.aod_documents SET linked_appointment_ids = full_ids WHERE id = rec.id;
    END IF;
  END LOOP;

  FOR rec IN SELECT id, notes FROM public.short_term_agreements WHERE notes IS NOT NULL LOOP
    SELECT COALESCE(array_agg(DISTINCT (m[1])::uuid), '{}')
      INTO full_ids
      FROM regexp_matches(rec.notes, 'APPOINTMENT:([0-9a-fA-F\-]{36})', 'g') m;
    IF array_length(full_ids, 1) > 0 THEN
      UPDATE public.short_term_agreements SET linked_appointment_ids = full_ids WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
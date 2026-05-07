-- 1) Consolidate duplicate expert_reports per appointment.
-- Keep the most-recently-updated row; delete the rest.
WITH ranked AS (
  SELECT id, appointment_id,
         row_number() OVER (
           PARTITION BY appointment_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.expert_reports
  WHERE appointment_id IS NOT NULL
)
DELETE FROM public.expert_reports er
USING ranked r
WHERE er.id = r.id AND r.rn > 1;

-- 2) Prevent duplicates going forward.
-- Partial unique index: only enforce when appointment_id IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS expert_reports_appointment_id_unique
  ON public.expert_reports (appointment_id)
  WHERE appointment_id IS NOT NULL;
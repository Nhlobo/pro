-- Drop the old restrictive check constraint
ALTER TABLE public.appointments DROP CONSTRAINT appointments_case_status_check;

-- Add updated check constraint with all valid case statuses
ALTER TABLE public.appointments ADD CONSTRAINT appointments_case_status_check 
CHECK (case_status = ANY (ARRAY[
  'scheduled'::text, 
  'assessed'::text, 
  'cancelled'::text, 
  'rescheduled'::text,
  'assessment_scheduled'::text,
  'assessment_completed'::text,
  'report_in_progress'::text,
  'report_submitted'::text,
  'report_delivered'::text,
  'under_review'::text,
  'revision_requested'::text,
  'finalised'::text,
  'closed'::text,
  'report submitted'::text
]));
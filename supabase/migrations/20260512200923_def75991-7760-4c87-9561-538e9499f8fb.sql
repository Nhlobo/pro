ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_case_status_check;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_case_status_check
CHECK (case_status = ANY (ARRAY[
  'scheduled','assessed','re-assessed','cancelled','rescheduled',
  'assessment_scheduled','assessment_completed','report_in_progress','report_submitted','report_delivered',
  'under_review','revision_requested','finalised','closed','report submitted',
  'Joint Minutes','Addendum','Affidavits','Court Preparation','Court Attendance','Merit Report'
]));
ALTER TABLE public.attorney_pitchlog DROP CONSTRAINT attorney_pitchlog_practice_area_check;
ALTER TABLE public.attorney_pitchlog ADD CONSTRAINT attorney_pitchlog_practice_area_check CHECK (practice_area = ANY (ARRAY['RAF'::text, 'Medical Negligence'::text, 'Both RAF & Med Neg'::text, 'Not Applicable'::text, 'Other Service'::text]));

ALTER TABLE public.attorney_pitchlog DROP CONSTRAINT attorney_pitchlog_pitch_status_check;
ALTER TABLE public.attorney_pitchlog ADD CONSTRAINT attorney_pitchlog_pitch_status_check CHECK (pitch_status = ANY (ARRAY['Pitched'::text, 'Re-pitched'::text, 'Followed Up'::text, 'Interested'::text, 'Not Interested'::text, 'No Answers'::text]));
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_matter_type_check;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_matter_type_check CHECK (matter_type = ANY (ARRAY['MVA', 'Medical Negligence', 'Merit Report', 'Assault Matter', 'Slip and Fall Matter', 'Joint Minutes', 'Addendum', 'Court Preparation', 'Court Attendance']::text[]));
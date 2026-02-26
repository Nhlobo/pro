
CREATE TABLE public.attorney_pitchlog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL,
  province text NOT NULL,
  law_firm_name text NOT NULL,
  attorney_type text NOT NULL CHECK (attorney_type IN ('Plaintiff', 'Defendant', 'State Attorney')),
  practice_area text NOT NULL CHECK (practice_area IN ('RAF', 'Medical Negligence')),
  contact_person text NOT NULL,
  email text,
  telephone text,
  sales_person text NOT NULL,
  pitch_status text NOT NULL DEFAULT 'Pitched' CHECK (pitch_status IN ('Pitched', 'Followed Up', 'Interested', 'Not Interested')),
  follow_up_date date,
  comment text,
  identified_challenge text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.attorney_pitchlog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and employees can manage pitchlog" ON public.attorney_pitchlog
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'employee')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'employee')
    )
  );

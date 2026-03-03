
CREATE TABLE public.pitchlog_weekly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_person text NOT NULL,
  month_year text NOT NULL,
  week_number integer NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  summary_comment text,
  weekly_strategy text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (sales_person, month_year, week_number)
);

ALTER TABLE public.pitchlog_weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and employees can manage weekly summaries"
ON public.pitchlog_weekly_summaries
FOR ALL
USING (
  (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'employee')))
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'employee')))
);

CREATE POLICY "Sales consultants can manage weekly summaries"
ON public.pitchlog_weekly_summaries
FOR ALL
USING (has_role(auth.uid(), 'sales_consultant'::app_role))
WITH CHECK (has_role(auth.uid(), 'sales_consultant'::app_role));

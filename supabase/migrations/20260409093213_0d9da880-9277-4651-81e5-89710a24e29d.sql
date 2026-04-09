
CREATE TABLE public.sales_team_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_month INTEGER,
  period_quarter INTEGER,
  period_year INTEGER NOT NULL,
  team_target INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (period_type, period_month, period_quarter, period_year)
);

ALTER TABLE public.sales_team_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view targets"
ON public.sales_team_targets FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert targets"
ON public.sales_team_targets FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update targets"
ON public.sales_team_targets FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete targets"
ON public.sales_team_targets FOR DELETE
TO authenticated USING (true);

CREATE TRIGGER update_sales_team_targets_updated_at
BEFORE UPDATE ON public.sales_team_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

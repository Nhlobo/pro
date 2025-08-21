-- Create targets table for managing assessment targets
CREATE TABLE public.targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_firm_id UUID NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  target_assessments INTEGER NOT NULL CHECK (target_assessments > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create case_sources table for tracking deal sources
CREATE TABLE public.case_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL,
  law_firm_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('MVA', 'Medical Negligence', 'Workers Compensation', 'Other')),
  source_details TEXT,
  assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_sources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for targets table
CREATE POLICY "Users can view targets from their law firm"
ON public.targets FOR SELECT
TO authenticated
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create targets for their law firm"
ON public.targets FOR INSERT
TO authenticated
WITH CHECK (
  law_firm_id = get_current_user_law_firm() 
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update targets from their law firm"
ON public.targets FOR UPDATE
TO authenticated
USING (law_firm_id = get_current_user_law_firm())
WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete targets from their law firm"
ON public.targets FOR DELETE
TO authenticated
USING (law_firm_id = get_current_user_law_firm());

-- Create RLS policies for case_sources table
CREATE POLICY "Users can view case sources from their law firm"
ON public.case_sources FOR SELECT
TO authenticated
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create case sources for their law firm"
ON public.case_sources FOR INSERT
TO authenticated
WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can update case sources from their law firm"
ON public.case_sources FOR UPDATE
TO authenticated
USING (law_firm_id = get_current_user_law_firm())
WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete case sources from their law firm"
ON public.case_sources FOR DELETE
TO authenticated
USING (law_firm_id = get_current_user_law_firm());

-- Add updated_at trigger for targets table
CREATE TRIGGER update_targets_updated_at
  BEFORE UPDATE ON public.targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_targets_law_firm_period ON public.targets (law_firm_id, period_start, period_end);
CREATE INDEX idx_targets_period_type ON public.targets (period_type, period_start);
CREATE INDEX idx_case_sources_law_firm ON public.case_sources (law_firm_id, assessment_date);
CREATE INDEX idx_case_sources_type_date ON public.case_sources (source_type, assessment_date);
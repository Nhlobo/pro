-- Create table for storing monthly assessment report archives
CREATE TABLE public.assessment_report_archives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  law_firm_id UUID NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  archived_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_assessments INTEGER NOT NULL DEFAULT 0,
  completed_reports INTEGER NOT NULL DEFAULT 0,
  pending_reports INTEGER NOT NULL DEFAULT 0,
  reports_taken_out INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  matter_type_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  expert_performance_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_trends_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.assessment_report_archives ENABLE ROW LEVEL SECURITY;

-- Create policies for assessment report archives
CREATE POLICY "Users can view archives from their law firm" 
ON public.assessment_report_archives 
FOR SELECT 
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create archives for their law firm" 
ON public.assessment_report_archives 
FOR INSERT 
WITH CHECK (law_firm_id = get_current_user_law_firm() AND created_by = auth.uid());

-- Create index for better query performance
CREATE INDEX idx_assessment_archives_law_firm_period ON public.assessment_report_archives(law_firm_id, period_start, period_end);

-- Create function to update timestamps
CREATE TRIGGER update_assessment_archives_updated_at
BEFORE UPDATE ON public.assessment_report_archives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
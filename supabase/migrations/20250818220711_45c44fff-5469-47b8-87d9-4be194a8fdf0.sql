-- Create assessment report archives table for 5-year data retention
CREATE TABLE public.assessment_report_archives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  law_firm_id UUID NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, yearly
  total_assessments INTEGER NOT NULL DEFAULT 0,
  completed_reports INTEGER NOT NULL DEFAULT 0,
  pending_reports INTEGER NOT NULL DEFAULT 0,
  reports_taken_out INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC NOT NULL DEFAULT 0,
  monthly_trends_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  expert_performance_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  matter_type_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
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

-- Add debt tracking columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS service_fee NUMERIC,
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0;
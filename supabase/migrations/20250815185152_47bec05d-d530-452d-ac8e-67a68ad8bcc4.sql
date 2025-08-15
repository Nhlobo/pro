-- Create expert_reports table to track report delivery and performance
CREATE TABLE public.expert_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL,
  claimant_id UUID NOT NULL,
  appointment_id UUID,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'deposit', 'full_payment', 'arranged'
  payment_date TIMESTAMP WITH TIME ZONE,
  report_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'overdue'
  report_due_date TIMESTAMP WITH TIME ZONE,
  report_submitted_date TIMESTAMP WITH TIME ZONE,
  days_to_complete INTEGER,
  expert_performance TEXT, -- 'good', 'average', 'bad'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expert_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view reports for their law firm" 
ON public.expert_reports 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.id = expert_reports.appointment_id 
    AND a.law_firm_id = get_current_user_law_firm()
  )
);

CREATE POLICY "Users can create reports for their law firm" 
ON public.expert_reports 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.id = expert_reports.appointment_id 
    AND a.law_firm_id = get_current_user_law_firm()
  )
);

CREATE POLICY "Users can update reports for their law firm" 
ON public.expert_reports 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.id = expert_reports.appointment_id 
    AND a.law_firm_id = get_current_user_law_firm()
  )
);

CREATE POLICY "Users can delete reports for their law firm" 
ON public.expert_reports 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.id = expert_reports.appointment_id 
    AND a.law_firm_id = get_current_user_law_firm()
  )
);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_expert_reports_updated_at
BEFORE UPDATE ON public.expert_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically calculate expert performance and days to complete
CREATE OR REPLACE FUNCTION public.calculate_expert_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if report is completed
  IF NEW.report_status = 'completed' AND NEW.report_submitted_date IS NOT NULL THEN
    -- Calculate days to complete
    IF NEW.payment_date IS NOT NULL THEN
      NEW.days_to_complete = EXTRACT(DAYS FROM (NEW.report_submitted_date - NEW.payment_date));
      
      -- Set performance based on days (7-30 days is the rule)
      IF NEW.days_to_complete <= 14 THEN
        NEW.expert_performance = 'good';
      ELSIF NEW.days_to_complete <= 25 THEN
        NEW.expert_performance = 'average';
      ELSE
        NEW.expert_performance = 'bad';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic performance calculation
CREATE TRIGGER calculate_expert_performance_trigger
BEFORE INSERT OR UPDATE ON public.expert_reports
FOR EACH ROW
EXECUTE FUNCTION public.calculate_expert_performance();
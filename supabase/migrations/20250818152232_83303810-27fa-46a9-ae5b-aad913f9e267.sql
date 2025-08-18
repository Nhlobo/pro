-- Create appointment archives table for storing historical data
CREATE TABLE public.appointment_archives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_appointments INTEGER NOT NULL DEFAULT 0,
  archived_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  law_firm_id UUID REFERENCES public.law_firms(id),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable Row Level Security
ALTER TABLE public.appointment_archives ENABLE ROW LEVEL SECURITY;

-- Create policies for appointment archives
CREATE POLICY "Users can view archives from their law firm" 
ON public.appointment_archives 
FOR SELECT 
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create archives for their law firm" 
ON public.appointment_archives 
FOR INSERT 
WITH CHECK (law_firm_id = get_current_user_law_firm());

-- Create index for better performance
CREATE INDEX idx_appointment_archives_period ON public.appointment_archives(period_type, period_start, period_end);
CREATE INDEX idx_appointment_archives_law_firm ON public.appointment_archives(law_firm_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_appointment_archives_updated_at
BEFORE UPDATE ON public.appointment_archives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
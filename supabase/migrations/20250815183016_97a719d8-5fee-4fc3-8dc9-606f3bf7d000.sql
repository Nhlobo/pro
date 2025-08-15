-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claimant_id UUID NOT NULL,
  referring_attorney TEXT NOT NULL,
  expert_id UUID NOT NULL,
  service_fee NUMERIC,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  deposit_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'deposit', 'full_payment')),
  payment_terms TEXT,
  agreement_duration_months INTEGER,
  case_status TEXT DEFAULT 'scheduled' CHECK (case_status IN ('scheduled', 'assessed', 'cancelled', 'rescheduled')),
  law_firm_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view appointments from their law firm" 
ON public.appointments 
FOR SELECT 
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create appointments for their law firm" 
ON public.appointments 
FOR INSERT 
WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can update appointments from their law firm" 
ON public.appointments 
FOR UPDATE 
USING (law_firm_id = get_current_user_law_firm())
WITH CHECK (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete appointments from their law firm" 
ON public.appointments 
FOR DELETE 
USING (law_firm_id = get_current_user_law_firm());

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
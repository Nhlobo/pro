-- Create appointment_requests table for handling appointment request submissions
CREATE TABLE public.appointment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  law_firm_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  referring_attorney_name TEXT NOT NULL,
  claimant_first_name TEXT NOT NULL,
  claimant_last_name TEXT NOT NULL,
  is_minor BOOLEAN NOT NULL DEFAULT FALSE,
  guardian_name TEXT,
  expert_type_requested TEXT NOT NULL,
  matter_type TEXT NOT NULL,
  special_requests TEXT[] DEFAULT '{}',
  province TEXT NOT NULL,
  preferred_date_type TEXT NOT NULL,
  suggested_date DATE,
  suggested_month TEXT,
  additional_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  approval_notes TEXT
);

-- Enable RLS
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for appointment requests
CREATE POLICY "Users can create appointment requests for their law firm" 
ON public.appointment_requests 
FOR INSERT 
WITH CHECK (law_firm_id = get_current_user_law_firm() AND requested_by = auth.uid());

CREATE POLICY "Users can view appointment requests from their law firm" 
ON public.appointment_requests 
FOR SELECT 
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Admins can view all appointment requests" 
ON public.appointment_requests 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update appointment requests" 
ON public.appointment_requests 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Add trigger for updating updated_at
CREATE TRIGGER update_appointment_requests_updated_at
BEFORE UPDATE ON public.appointment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
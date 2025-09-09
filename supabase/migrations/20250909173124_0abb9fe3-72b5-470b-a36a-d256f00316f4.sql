-- Create attorneys table for CRM
CREATE TABLE public.attorneys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  specialization TEXT[] DEFAULT '{}',
  email TEXT,
  phone TEXT,
  law_firm TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'potential' CHECK (status IN ('potential', 'pitched', 'interested', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  law_firm_id UUID REFERENCES public.law_firms(id)
);

-- Create pitch_logs table for tracking interactions
CREATE TABLE public.pitch_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attorney_id UUID REFERENCES public.attorneys(id) ON DELETE CASCADE NOT NULL,
  pitch_date DATE NOT NULL,
  pitch_notes TEXT,
  feedback_comments TEXT,
  follow_up_reminder DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  law_firm_id UUID REFERENCES public.law_firms(id)
);

-- Enable RLS on attorneys table
ALTER TABLE public.attorneys ENABLE ROW LEVEL SECURITY;

-- RLS policies for attorneys
CREATE POLICY "Users can view attorneys from their law firm"
ON public.attorneys FOR SELECT
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create attorneys for their law firm"
ON public.attorneys FOR INSERT
WITH CHECK (law_firm_id = get_current_user_law_firm() AND created_by = auth.uid());

CREATE POLICY "Users can update attorneys from their law firm"
ON public.attorneys FOR UPDATE
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete attorneys from their law firm"
ON public.attorneys FOR DELETE
USING (law_firm_id = get_current_user_law_firm());

-- Enable RLS on pitch_logs table
ALTER TABLE public.pitch_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for pitch_logs
CREATE POLICY "Users can view pitch logs from their law firm"
ON public.pitch_logs FOR SELECT
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create pitch logs for their law firm"
ON public.pitch_logs FOR INSERT
WITH CHECK (law_firm_id = get_current_user_law_firm() AND created_by = auth.uid());

CREATE POLICY "Users can update pitch logs from their law firm"
ON public.pitch_logs FOR UPDATE
USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete pitch logs from their law firm"
ON public.pitch_logs FOR DELETE
USING (law_firm_id = get_current_user_law_firm());

-- Create indexes for better performance
CREATE INDEX idx_attorneys_status ON public.attorneys(status);
CREATE INDEX idx_attorneys_specialization ON public.attorneys USING GIN(specialization);
CREATE INDEX idx_attorneys_law_firm_id ON public.attorneys(law_firm_id);
CREATE INDEX idx_pitch_logs_attorney_id ON public.pitch_logs(attorney_id);
CREATE INDEX idx_pitch_logs_law_firm_id ON public.pitch_logs(law_firm_id);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_attorneys_updated_at
BEFORE UPDATE ON public.attorneys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create table for tracking response times and ratings for appointment requests
CREATE TABLE public.appointment_request_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_request_id UUID NOT NULL,
  response_time_hours NUMERIC,
  response_rating TEXT CHECK (response_rating IN ('excellent', 'good', 'average', 'slow', 'very_slow')),
  first_response_at TIMESTAMP WITH TIME ZONE,
  final_response_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (appointment_request_id) REFERENCES public.appointment_requests(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.appointment_request_ratings ENABLE ROW LEVEL SECURITY;

-- Create policies for appointment request ratings
CREATE POLICY "Admins can manage all appointment request ratings" 
ON public.appointment_request_ratings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Users can view ratings from their law firm" 
ON public.appointment_request_ratings 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.appointment_requests ar
  JOIN public.profiles p ON p.law_firm_id = ar.law_firm_id
  WHERE ar.id = appointment_request_ratings.appointment_request_id
  AND p.id = auth.uid()
));

-- Create function to calculate response rating based on hours
CREATE OR REPLACE FUNCTION public.calculate_response_rating(hours NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN hours <= 2 THEN 'excellent'
    WHEN hours <= 8 THEN 'good'
    WHEN hours <= 24 THEN 'average'
    WHEN hours <= 72 THEN 'slow'
    ELSE 'very_slow'
  END;
$$;

-- Create trigger to automatically calculate ratings when response times are set
CREATE OR REPLACE FUNCTION public.update_appointment_request_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate response time if first_response_at is set
  IF NEW.first_response_at IS NOT NULL AND OLD.first_response_at IS NULL THEN
    SELECT 
      EXTRACT(EPOCH FROM (NEW.first_response_at - ar.created_at))/3600,
      ar.created_at
    INTO NEW.response_time_hours, NEW.created_at
    FROM public.appointment_requests ar
    WHERE ar.id = NEW.appointment_request_id;
    
    -- Auto-calculate rating based on response time
    NEW.response_rating = public.calculate_response_rating(NEW.response_time_hours);
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_appointment_request_rating
  BEFORE UPDATE ON public.appointment_request_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_appointment_request_rating();

-- Create trigger for updated_at
CREATE TRIGGER update_appointment_request_ratings_updated_at
  BEFORE UPDATE ON public.appointment_request_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
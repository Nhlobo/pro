-- Create table for negligence analysis history
CREATE TABLE IF NOT EXISTS public.negligence_analysis_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  overall_severity TEXT NOT NULL,
  indicator_count INTEGER NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  recommendation_count INTEGER NOT NULL DEFAULT 0,
  processing_time INTEGER NOT NULL,
  analysis_result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.negligence_analysis_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own negligence analysis history" 
ON public.negligence_analysis_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own negligence analysis history" 
ON public.negligence_analysis_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_negligence_analysis_history_user_id ON public.negligence_analysis_history(user_id);
CREATE INDEX idx_negligence_analysis_history_created_at ON public.negligence_analysis_history(created_at DESC);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_negligence_analysis_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_negligence_analysis_history_updated_at
BEFORE UPDATE ON public.negligence_analysis_history
FOR EACH ROW
EXECUTE FUNCTION public.update_negligence_analysis_history_updated_at();
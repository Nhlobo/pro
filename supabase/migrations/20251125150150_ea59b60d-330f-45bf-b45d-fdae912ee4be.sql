-- Create proofreading history table
CREATE TABLE IF NOT EXISTS public.proofreading_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  quality_score INTEGER NOT NULL,
  total_changes INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL DEFAULT 0,
  compression_applied BOOLEAN DEFAULT FALSE,
  original_size TEXT,
  compressed_size TEXT,
  processing_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_proofreading_history_user_id ON public.proofreading_history(user_id);
CREATE INDEX idx_proofreading_history_created_at ON public.proofreading_history(created_at);

-- Enable RLS
ALTER TABLE public.proofreading_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own proofreading history"
  ON public.proofreading_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own proofreading history"
  ON public.proofreading_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System admins can view all proofreading history"
  ON public.proofreading_history
  FOR SELECT
  USING (is_system_admin());

CREATE POLICY "System admins can delete proofreading history"
  ON public.proofreading_history
  FOR DELETE
  USING (is_system_admin());

-- Function to auto-delete records older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_proofreading_history()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.proofreading_history
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % old proofreading history records', deleted_count;
  END IF;
  
  RETURN deleted_count;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_proofreading_history_updated_at
  BEFORE UPDATE ON public.proofreading_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
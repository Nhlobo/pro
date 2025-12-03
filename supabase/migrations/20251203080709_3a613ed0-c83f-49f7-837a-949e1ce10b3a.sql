-- Add status column to proofreading_history for background processing
ALTER TABLE public.proofreading_history 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS result_data jsonb;

-- Add status column to negligence_analysis_history for background processing  
ALTER TABLE public.negligence_analysis_history
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

-- Create index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_proofreading_history_status ON public.proofreading_history(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_negligence_analysis_history_status ON public.negligence_analysis_history(user_id, status, created_at DESC);
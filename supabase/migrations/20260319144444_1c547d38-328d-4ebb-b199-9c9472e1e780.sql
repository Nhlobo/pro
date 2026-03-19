
-- Add attendance/monitoring columns to email_queue
ALTER TABLE public.email_queue 
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_responded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS forwarded_to text,
  ADD COLUMN IF NOT EXISTS forwarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS forwarded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS forward_notes text;

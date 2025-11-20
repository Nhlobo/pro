-- Create email queue table for previewing emails before sending
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'rejected')),
  related_record_id TEXT,
  related_table TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Policies for email queue
CREATE POLICY "Email queue viewable by authenticated users"
  ON public.email_queue
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Email queue updatable by authenticated users"
  ON public.email_queue
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Email queue insertable by service role"
  ON public.email_queue
  FOR INSERT
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_email_queue_status ON public.email_queue(status);
CREATE INDEX idx_email_queue_created_at ON public.email_queue(created_at DESC);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE email_queue;
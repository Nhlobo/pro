
-- Create table for attorney marketing emails
CREATE TABLE public.attorney_marketing_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attorney_name TEXT NOT NULL,
  email TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on email to prevent duplicates
CREATE UNIQUE INDEX idx_attorney_marketing_emails_unique_email ON public.attorney_marketing_emails (LOWER(email));

-- Enable RLS
ALTER TABLE public.attorney_marketing_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admin and employees can access
CREATE POLICY "Admin and employees can view marketing emails"
ON public.attorney_marketing_emails FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
);

CREATE POLICY "Admin and employees can insert marketing emails"
ON public.attorney_marketing_emails FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
);

CREATE POLICY "Admin and employees can update marketing emails"
ON public.attorney_marketing_emails FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
);

CREATE POLICY "Admin and employees can delete marketing emails"
ON public.attorney_marketing_emails FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
);

-- Trigger for updated_at
CREATE TRIGGER update_attorney_marketing_emails_updated_at
BEFORE UPDATE ON public.attorney_marketing_emails
FOR EACH ROW EXECUTE FUNCTION public.update_webhook_configs_updated_at();

-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  category TEXT,
  related_record_id UUID,
  related_table TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System admins can manage all notifications
CREATE POLICY "System admins full access to notifications"
ON public.notifications
FOR ALL
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Allow inserts for notification creation (service role or authenticated)
CREATE POLICY "Allow notification creation"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create document_checklist table to track required documents per claimant/appointment
CREATE TABLE public.document_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claimant_id UUID NOT NULL REFERENCES public.claimants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(claimant_id, document_type)
);

-- Enable RLS
ALTER TABLE public.document_checklist ENABLE ROW LEVEL SECURITY;

-- Users can view checklist for their referring attorney's claimants
CREATE POLICY "Users can view document checklist for their claimants"
ON public.document_checklist
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.claimants c
    WHERE c.id = document_checklist.claimant_id
    AND c.referring_attorney_id = get_current_user_referring_attorney()
  )
  OR is_system_admin()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'employee')
);

-- Users can update checklist for their claimants
CREATE POLICY "Users can update document checklist for their claimants"
ON public.document_checklist
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.claimants c
    WHERE c.id = document_checklist.claimant_id
    AND c.referring_attorney_id = get_current_user_referring_attorney()
  )
  OR is_system_admin()
);

-- Users can insert checklist items for their claimants
CREATE POLICY "Users can insert document checklist for their claimants"
ON public.document_checklist
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.claimants c
    WHERE c.id = document_checklist.claimant_id
    AND c.referring_attorney_id = get_current_user_referring_attorney()
  )
  OR is_system_admin()
);

-- System admins full access
CREATE POLICY "System admins full access to document checklist"
ON public.document_checklist
FOR ALL
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_document_checklist_updated_at
BEFORE UPDATE ON public.document_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on notifications
CREATE TRIGGER update_notifications_read_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_document_checklist_claimant ON public.document_checklist(claimant_id);
CREATE INDEX idx_document_checklist_appointment ON public.document_checklist(appointment_id);
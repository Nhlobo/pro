-- Create table for employee notification preferences
CREATE TABLE public.employee_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  receive_appointment_requests BOOLEAN DEFAULT true,
  receive_assessment_changes BOOLEAN DEFAULT true,
  receive_payment_changes BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only admins can manage employee notifications"
ON public.employee_notifications
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view their own notification settings"
ON public.employee_notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notification settings"
ON public.employee_notifications
FOR UPDATE
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_employee_notifications_updated_at
BEFORE UPDATE ON public.employee_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default notification settings for admin users
INSERT INTO public.employee_notifications (user_id, email, receive_appointment_requests, receive_assessment_changes, receive_payment_changes)
SELECT 
  p.id, 
  p.email, 
  true, 
  true, 
  true
FROM public.profiles p
WHERE p.role = 'admin' AND p.email IS NOT NULL
ON CONFLICT DO NOTHING;
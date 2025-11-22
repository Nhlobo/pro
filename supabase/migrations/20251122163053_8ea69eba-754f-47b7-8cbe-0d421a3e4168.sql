-- Create expert_payments table to track payments TO medical experts
CREATE TABLE IF NOT EXISTS public.expert_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL REFERENCES medical_experts(id) ON DELETE CASCADE,
  payment_amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  payment_notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expert_payments ENABLE ROW LEVEL SECURITY;

-- System admins full access
CREATE POLICY "System admins full access to expert payments"
ON public.expert_payments
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Users can view payments for appointments from their referring attorney
CREATE POLICY "Users can view expert payments from their referring attorney"
ON public.expert_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id = expert_payments.appointment_id
    AND a.referring_attorney_id = get_current_user_referring_attorney()
  )
);

-- Users can create expert payments for their referring attorney
CREATE POLICY "Users can create expert payments for their referring attorney"
ON public.expert_payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id = expert_payments.appointment_id
    AND a.referring_attorney_id = get_current_user_referring_attorney()
  )
  AND recorded_by = auth.uid()
);

-- Users can update expert payments from their referring attorney
CREATE POLICY "Users can update expert payments from their referring attorney"
ON public.expert_payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id = expert_payments.appointment_id
    AND a.referring_attorney_id = get_current_user_referring_attorney()
  )
);

-- Admins and employees can view all expert payments
CREATE POLICY "Admins and employees can view all expert payments"
ON public.expert_payments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id = expert_payments.appointment_id
    AND a.referring_attorney_id = get_current_user_referring_attorney()
  )
);

-- Create index for performance
CREATE INDEX idx_expert_payments_appointment ON expert_payments(appointment_id);
CREATE INDEX idx_expert_payments_expert ON expert_payments(expert_id);
CREATE INDEX idx_expert_payments_date ON expert_payments(payment_date);
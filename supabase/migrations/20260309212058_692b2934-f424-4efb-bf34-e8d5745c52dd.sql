
CREATE TABLE public.litigation_service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  case_reference TEXT,
  urgency TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  trial_date DATE,
  requested_by UUID REFERENCES auth.users(id) NOT NULL,
  referring_attorney_id UUID REFERENCES public.referring_attorneys(id),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.litigation_service_requests ENABLE ROW LEVEL SECURITY;

-- Admins/employees full access
CREATE POLICY "Admins and employees can manage all litigation requests"
ON public.litigation_service_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- System admin bypass
CREATE POLICY "System admins full access to litigation requests"
ON public.litigation_service_requests
FOR ALL
TO authenticated
USING (is_system_admin())
WITH CHECK (is_system_admin());

-- Users can create requests
CREATE POLICY "Users can create litigation service requests"
ON public.litigation_service_requests
FOR INSERT
TO authenticated
WITH CHECK (requested_by = auth.uid());

-- Users can view their own requests
CREATE POLICY "Users can view own litigation service requests"
ON public.litigation_service_requests
FOR SELECT
TO authenticated
USING (requested_by = auth.uid() OR referring_attorney_id = get_current_user_referring_attorney());

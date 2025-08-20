-- Create audit log table for tracking changes to core functions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_fields JSONB,
  user_id UUID NOT NULL,
  user_email TEXT,
  function_area TEXT NOT NULL, -- 'claimant', 'attorney', 'expert', 'assessment'
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for audit logs
CREATE POLICY "Users can view audit logs from their law firm" 
ON public.audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      profiles.role = 'admin' OR
      profiles.law_firm_id = (
        SELECT p2.law_firm_id 
        FROM public.profiles p2 
        WHERE p2.id = audit_logs.user_id
      )
    )
  )
);

CREATE POLICY "System can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_function ON public.audit_logs(user_id, function_area);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Create function to log audit trail
CREATE OR REPLACE FUNCTION public.log_audit_trail(
  p_table_name TEXT,
  p_record_id UUID,
  p_action_type TEXT,
  p_function_area TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  audit_id UUID;
  user_profile RECORD;
  changed_fields JSONB := '{}';
  field_key TEXT;
BEGIN
  -- Get user profile information
  SELECT email, law_firm_id INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Calculate changed fields if both old and new values exist
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    FOR field_key IN SELECT jsonb_object_keys(p_new_values)
    LOOP
      IF p_old_values->>field_key IS DISTINCT FROM p_new_values->>field_key THEN
        changed_fields := changed_fields || jsonb_build_object(
          field_key, 
          jsonb_build_object(
            'old', p_old_values->field_key,
            'new', p_new_values->field_key
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action_type,
    old_values,
    new_values,
    changed_fields,
    user_id,
    user_email,
    function_area,
    description
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action_type,
    p_old_values,
    p_new_values,
    changed_fields,
    auth.uid(),
    user_profile.email,
    p_function_area,
    p_description
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$function$;
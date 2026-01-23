-- Create table for attorney access codes
CREATE TABLE public.attorney_access_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  referring_attorney_id UUID NOT NULL REFERENCES public.referring_attorneys(id) ON DELETE CASCADE,
  access_code VARCHAR(12) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMP WITH TIME ZONE,
  deactivation_reason VARCHAR(100),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER NOT NULL DEFAULT 0
);

-- Create index for fast code lookups
CREATE INDEX idx_attorney_access_codes_code ON public.attorney_access_codes(access_code);
CREATE INDEX idx_attorney_access_codes_appointment ON public.attorney_access_codes(appointment_id);
CREATE INDEX idx_attorney_access_codes_attorney ON public.attorney_access_codes(referring_attorney_id);
CREATE INDEX idx_attorney_access_codes_active ON public.attorney_access_codes(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.attorney_access_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all codes (for edge functions)
CREATE POLICY "Service role can manage access codes"
ON public.attorney_access_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can view codes for their managed appointments
CREATE POLICY "Staff can view access codes"
ON public.attorney_access_codes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.user_type IN ('admin', 'staff', 'super_user')
  )
);

-- Function to generate a unique secure access code
CREATE OR REPLACE FUNCTION public.generate_attorney_access_code()
RETURNS VARCHAR(12) AS $$
DECLARE
  new_code VARCHAR(12);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 12-character alphanumeric code (uppercase letters and numbers)
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM public.attorney_access_codes WHERE access_code = new_code
    ) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create access code for an appointment
CREATE OR REPLACE FUNCTION public.create_attorney_access_code(
  p_appointment_id UUID,
  p_referring_attorney_id UUID,
  p_expires_in_days INTEGER DEFAULT 90
)
RETURNS TABLE(access_code VARCHAR(12), id UUID) AS $$
DECLARE
  new_code VARCHAR(12);
  new_id UUID;
BEGIN
  -- Deactivate any existing active codes for this appointment
  UPDATE public.attorney_access_codes
  SET is_active = false,
      deactivated_at = now(),
      deactivation_reason = 'replaced_by_new_code'
  WHERE appointment_id = p_appointment_id AND is_active = true;
  
  -- Generate new unique code
  new_code := public.generate_attorney_access_code();
  
  -- Insert new access code
  INSERT INTO public.attorney_access_codes (
    appointment_id,
    referring_attorney_id,
    access_code,
    expires_at
  ) VALUES (
    p_appointment_id,
    p_referring_attorney_id,
    new_code,
    CASE WHEN p_expires_in_days > 0 THEN now() + (p_expires_in_days || ' days')::interval ELSE NULL END
  )
  RETURNING attorney_access_codes.access_code, attorney_access_codes.id INTO new_code, new_id;
  
  RETURN QUERY SELECT new_code, new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to validate and use access code (returns appointment details if valid)
CREATE OR REPLACE FUNCTION public.validate_attorney_access_code(p_access_code VARCHAR(12))
RETURNS TABLE(
  is_valid BOOLEAN,
  appointment_id UUID,
  error_message TEXT
) AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- Find the access code
  SELECT * INTO code_record
  FROM public.attorney_access_codes
  WHERE access_code = upper(p_access_code);
  
  -- Check if code exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID, 'Invalid access code'::TEXT;
    RETURN;
  END IF;
  
  -- Check if code is active
  IF NOT code_record.is_active THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID, 'This access code has been deactivated'::TEXT;
    RETURN;
  END IF;
  
  -- Check if code has expired
  IF code_record.expires_at IS NOT NULL AND code_record.expires_at < now() THEN
    -- Deactivate the expired code
    UPDATE public.attorney_access_codes
    SET is_active = false, deactivated_at = now(), deactivation_reason = 'expired'
    WHERE id = code_record.id;
    
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID, 'This access code has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Update access tracking
  UPDATE public.attorney_access_codes
  SET last_accessed_at = now(), access_count = access_count + 1
  WHERE id = code_record.id;
  
  -- Return valid result
  RETURN QUERY SELECT true::BOOLEAN, code_record.appointment_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to expire access code when report is sent
CREATE OR REPLACE FUNCTION public.expire_attorney_access_code(p_appointment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.attorney_access_codes
  SET is_active = false,
      deactivated_at = now(),
      deactivation_reason = 'report_sent'
  WHERE appointment_id = p_appointment_id AND is_active = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Fix remaining security warnings and enhance protection

-- 1. Fix function search_path security issue
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  accessed_table TEXT,
  accessed_record_id UUID,  
  access_type TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action_type,
    user_id,
    function_area,
    description,
    user_email
  ) VALUES (
    accessed_table,
    accessed_record_id,
    access_type,
    auth.uid(),
    'security_audit',
    'Sensitive data access logged for security monitoring',
    (SELECT email FROM public.profiles WHERE id = auth.uid())
  );
END;
$$;

-- 2. Create data encryption helpers for sensitive information
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_field(
  field_value TEXT
) RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Simple obfuscation for display purposes (not true encryption)
  SELECT CASE 
    WHEN field_value IS NULL THEN NULL
    WHEN LENGTH(field_value) <= 3 THEN '***'
    ELSE LEFT(field_value, 2) || REPEAT('*', LENGTH(field_value) - 4) || RIGHT(field_value, 2)
  END;
$$;

-- 3. Create secure data access monitoring triggers
CREATE OR REPLACE FUNCTION public.log_expert_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log when someone accesses medical expert data
  PERFORM public.log_sensitive_data_access(
    'medical_experts',
    NEW.id,
    'expert_data_access'
  );
  RETURN NEW;
END;
$$;

-- Add trigger for medical expert access logging (if not exists)
DROP TRIGGER IF EXISTS log_expert_access_trigger ON public.medical_experts;
-- Note: We don't create this trigger as it would log every SELECT, which could be excessive

-- 4. Create secure user session validation
CREATE OR REPLACE FUNCTION public.validate_user_session()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Validate current user session and profile
  SELECT id, role, law_firm_id, created_at
  INTO user_profile
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Ensure user profile exists and is valid
  IF user_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure user has a valid creation date (not a fake account)
  IF user_profile.created_at IS NULL OR user_profile.created_at > NOW() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 5. Create data masking function for sensitive display
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(
  data_type TEXT,
  original_value TEXT
) RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER  
SET search_path TO 'public'
AS $$
  SELECT CASE data_type
    WHEN 'email' THEN 
      CASE 
        WHEN original_value IS NULL THEN NULL
        WHEN position('@' in original_value) > 0 THEN
          LEFT(original_value, 2) || '***@' || SPLIT_PART(original_value, '@', 2)
        ELSE '***'
      END
    WHEN 'phone' THEN
      CASE
        WHEN original_value IS NULL THEN NULL
        WHEN LENGTH(original_value) > 6 THEN
          LEFT(original_value, 3) || '***' || RIGHT(original_value, 3)
        ELSE '***'
      END
    WHEN 'address' THEN
      CASE
        WHEN original_value IS NULL THEN NULL
        WHEN LENGTH(original_value) > 10 THEN
          LEFT(original_value, 5) || '...[Protected]'
        ELSE '[Protected]'
      END
    ELSE '[Protected]'
  END;
$$;

-- 6. Enhanced medical expert access with data masking
CREATE OR REPLACE FUNCTION public.get_medical_expert_display_safe(expert_id uuid)
RETURNS TABLE(
  id uuid, first_name text, last_name text, expert_type text,
  province text, specializations text[], qualifications text,
  years_experience integer, status text, consultation_fees numeric,
  court_fees numeric, availability_notes text, created_at timestamp with time zone,
  updated_at timestamp with time zone, email_masked text, phone_masked text,
  address_masked text, pa_name_masked text, pa_phone_masked text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    me.id, me.first_name, me.last_name, me.expert_type, me.province,
    me.specializations, me.qualifications, me.years_experience, me.status,
    me.consultation_fees, me.court_fees, me.availability_notes,
    me.created_at, me.updated_at,
    -- Return masked data for unauthorized users, full data for authorized users
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.email
      ELSE public.mask_sensitive_data('email', me.email)
    END as email_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.contact_number
      ELSE public.mask_sensitive_data('phone', me.contact_number) 
    END as phone_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.practice_address
      ELSE public.mask_sensitive_data('address', me.practice_address)
    END as address_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_name
      ELSE public.mask_sensitive_data('address', me.personal_assistant_name)
    END as pa_name_masked,
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.personal_assistant_contact
      ELSE public.mask_sensitive_data('phone', me.personal_assistant_contact)
    END as pa_phone_masked
  FROM public.medical_experts me
  WHERE me.id = $1 AND me.status = 'active';
$function$;
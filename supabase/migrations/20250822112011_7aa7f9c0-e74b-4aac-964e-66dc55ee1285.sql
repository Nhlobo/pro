-- Create secure function to get medical experts with proper access control
CREATE OR REPLACE FUNCTION public.get_medical_experts_secure()
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  expert_type text,
  province text,
  specializations text[],
  qualifications text,
  years_experience integer,
  status text,
  consultation_fees numeric,
  court_fees numeric,
  availability_notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email_masked text,
  phone_masked text,
  address_masked text,
  pa_name_masked text,
  pa_phone_masked text,
  cv_document_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    me.id,
    me.first_name,
    me.last_name,
    me.expert_type,
    me.province,
    me.specializations,
    me.qualifications,
    me.years_experience,
    me.status,
    me.consultation_fees,
    me.court_fees,
    me.availability_notes,
    me.created_at,
    me.updated_at,
    -- Return masked or full data based on admin status and appointments
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
    END as pa_phone_masked,
    -- CV document is only accessible to admins or users with appointments
    CASE 
      WHEN public.can_view_expert_contacts(me.id) THEN me.cv_document_url
      ELSE NULL
    END as cv_document_url
  FROM public.medical_experts me
  WHERE me.status = 'active'
    AND (
      -- Admin users can see all experts
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      OR
      -- Regular users can only see experts they have appointments with via their law firm
      EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.expert_id = me.id 
        AND a.law_firm_id = public.get_current_user_law_firm()
      )
    )
  ORDER BY me.province, me.last_name;
$$;

-- Create secure function for scheduled assessments with proper law firm isolation
CREATE OR REPLACE FUNCTION public.get_scheduled_assessments_secure()
RETURNS TABLE(
  appointment_id uuid,
  claimant_auto_id text,
  claimant_name text,
  expert_name text,
  expert_type text,
  appointment_date timestamp with time zone,
  deposit_amount numeric,
  payment_date timestamp with time zone,
  case_status text,
  referring_attorney text,
  report_status text,
  report_submitted_date timestamp with time zone,
  law_firm_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id as appointment_id,
    c.auto_id as claimant_auto_id,
    CONCAT(c.first_name, ' ', c.last_name) as claimant_name,
    CONCAT(me.first_name, ' ', me.last_name) as expert_name,
    me.expert_type,
    a.appointment_date,
    a.deposit_amount,
    a.payment_date,
    a.case_status,
    a.referring_attorney,
    COALESCE(er.report_status, 'not_received') as report_status,
    er.report_submitted_date,
    a.law_firm_id
  FROM public.appointments a
  LEFT JOIN public.claimants c ON a.claimant_id = c.id
  LEFT JOIN public.medical_experts me ON a.expert_id = me.id
  LEFT JOIN public.expert_reports er ON a.id = er.appointment_id
  WHERE a.law_firm_id = public.get_current_user_law_firm()
    AND auth.uid() IS NOT NULL
  ORDER BY a.appointment_date DESC;
$$;

-- Add RLS policy for expert_reports to ensure law firm isolation
CREATE POLICY "Users can only view expert reports for their law firm appointments"
ON public.expert_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = expert_reports.appointment_id
    AND a.law_firm_id = public.get_current_user_law_firm()
  )
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_medical_experts_secure() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduled_assessments_secure() TO authenticated;
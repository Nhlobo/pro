-- Enable referring attorneys to update their own company profile
-- This allows referring attorneys to update contact information for their own company

-- First, ensure RLS is enabled on referring_attorneys table
ALTER TABLE public.referring_attorneys ENABLE ROW LEVEL SECURITY;

-- Add policy for referring attorneys to view their own profile
CREATE POLICY "Referring attorneys can view their own profile"
  ON public.referring_attorneys
  FOR SELECT
  USING (
    id IN (
      SELECT referring_attorney_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
        AND role = 'referring_attorney'
    )
  );

-- Add policy for referring attorneys to update their own profile
CREATE POLICY "Referring attorneys can update their own profile"
  ON public.referring_attorneys
  FOR UPDATE
  USING (
    id IN (
      SELECT referring_attorney_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
        AND role = 'referring_attorney'
    )
  )
  WITH CHECK (
    id IN (
      SELECT referring_attorney_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
        AND role = 'referring_attorney'
    )
  );

-- Log profile updates for audit trail
CREATE OR REPLACE FUNCTION public.log_referring_attorney_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if contact information changed
  IF (OLD.contact_person IS DISTINCT FROM NEW.contact_person) OR
     (OLD.email IS DISTINCT FROM NEW.email) OR
     (OLD.phone IS DISTINCT FROM NEW.phone) THEN
    
    PERFORM public.log_audit_trail(
      'referring_attorneys',
      NEW.id,
      'UPDATE',
      'profile_management',
      jsonb_build_object(
        'contact_person', OLD.contact_person,
        'email', OLD.email,
        'phone', OLD.phone
      ),
      jsonb_build_object(
        'contact_person', NEW.contact_person,
        'email', NEW.email,
        'phone', NEW.phone
      ),
      'Referring attorney updated company profile'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for profile updates
DROP TRIGGER IF EXISTS log_referring_attorney_profile_changes ON public.referring_attorneys;
CREATE TRIGGER log_referring_attorney_profile_changes
  AFTER UPDATE ON public.referring_attorneys
  FOR EACH ROW
  EXECUTE FUNCTION public.log_referring_attorney_profile_update();
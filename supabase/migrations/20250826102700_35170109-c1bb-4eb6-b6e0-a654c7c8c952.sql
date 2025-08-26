-- Fix the update_user_profile function to use correct action_type
CREATE OR REPLACE FUNCTION public.update_user_profile(
  user_id_param UUID,
  first_name_param TEXT DEFAULT NULL,
  last_name_param TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if current user is admin or updating their own profile
  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR user_id_param = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied. Only admins or users themselves can update profile information.';
  END IF;

  -- Update the profile
  UPDATE public.profiles 
  SET 
    first_name = COALESCE(first_name_param, first_name),
    last_name = COALESCE(last_name_param, last_name),
    updated_at = now()
  WHERE id = user_id_param;

  -- Log the update with correct action_type
  PERFORM public.log_audit_trail(
    'profiles',
    user_id_param,
    'UPDATE',  -- Changed from 'update' to 'UPDATE'
    'user_management',
    NULL,
    jsonb_build_object(
      'first_name', first_name_param,
      'last_name', last_name_param
    ),
    'Profile name updated'
  );

  RETURN FOUND;
END;
$$;
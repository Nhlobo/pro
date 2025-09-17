-- Create RPC function to allow admins and employees to see all attorneys
CREATE OR REPLACE FUNCTION get_all_attorneys_for_admin()
RETURNS SETOF attorneys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Check if user is primary admin by email
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'boshomane@kutlwanoassociate.com'
  ) THEN
    current_user_role := 'admin';
  END IF;
  
  -- Only allow admin and employee users to see all attorneys
  IF current_user_role IN ('admin', 'employee') THEN
    RETURN QUERY SELECT * FROM attorneys ORDER BY created_at DESC;
  ELSE
    -- For other users, return only their law firm's attorneys (existing behavior)
    RETURN QUERY 
    SELECT * FROM attorneys 
    WHERE law_firm_id = get_current_user_law_firm()
    ORDER BY created_at DESC;
  END IF;
END;
$$;
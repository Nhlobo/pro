-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view claimants from their referring attorney" ON public.claimants;
DROP POLICY IF EXISTS "Users can create claimants for their referring attorney" ON public.claimants;
DROP POLICY IF EXISTS "Users can update claimants from their referring attorney" ON public.claimants;
DROP POLICY IF EXISTS "Users can delete claimants from their referring attorney" ON public.claimants;

-- Recreate policies with proper role-based access
-- Allow admins and employees to view all claimants, referring attorneys to view their own
CREATE POLICY "Users can view claimants based on role"
ON public.claimants
FOR SELECT
TO authenticated
USING (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
);

-- Allow admins and employees to create claimants, referring attorneys for their own
CREATE POLICY "Users can create claimants based on role"
ON public.claimants
FOR INSERT
TO authenticated
WITH CHECK (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
);

-- Allow admins and employees to update all claimants, referring attorneys their own
CREATE POLICY "Users can update claimants based on role"
ON public.claimants
FOR UPDATE
TO authenticated
USING (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
)
WITH CHECK (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
);

-- Allow admins and employees to delete claimants, referring attorneys their own
CREATE POLICY "Users can delete claimants based on role"
ON public.claimants
FOR DELETE
TO authenticated
USING (
  is_system_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR (
    referring_attorney_id = get_current_user_referring_attorney()
    AND get_current_user_referring_attorney() IS NOT NULL
  )
);
-- Add RLS policies for claimants table to allow referring attorneys to access their claimants

-- Allow users to view claimants from their referring attorney
CREATE POLICY "Users can view claimants from their referring attorney"
ON public.claimants
FOR SELECT
TO authenticated
USING (
  referring_attorney_id = get_current_user_referring_attorney()
  OR is_system_admin()
);

-- Allow users to create claimants for their referring attorney
CREATE POLICY "Users can create claimants for their referring attorney"
ON public.claimants
FOR INSERT
TO authenticated
WITH CHECK (
  referring_attorney_id = get_current_user_referring_attorney()
  OR is_system_admin()
);

-- Allow users to update claimants from their referring attorney
CREATE POLICY "Users can update claimants from their referring attorney"
ON public.claimants
FOR UPDATE
TO authenticated
USING (
  referring_attorney_id = get_current_user_referring_attorney()
  OR is_system_admin()
)
WITH CHECK (
  referring_attorney_id = get_current_user_referring_attorney()
  OR is_system_admin()
);

-- Allow users to delete claimants from their referring attorney
CREATE POLICY "Users can delete claimants from their referring attorney"
ON public.claimants
FOR DELETE
TO authenticated
USING (
  referring_attorney_id = get_current_user_referring_attorney()
  OR is_system_admin()
);
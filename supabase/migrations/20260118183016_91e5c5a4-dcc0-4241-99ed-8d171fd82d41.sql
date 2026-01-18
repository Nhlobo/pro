-- Add DELETE policy for referring_attorneys table for admins and employees
-- First check if policy exists before creating

DO $$
BEGIN
  -- Drop existing delete policy if it exists
  DROP POLICY IF EXISTS "Admins and employees can delete referring attorneys" ON public.referring_attorneys;
  
  -- Create new delete policy
  CREATE POLICY "Admins and employees can delete referring attorneys"
  ON public.referring_attorneys
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'employee'::app_role) OR
    is_system_admin()
  );
END $$;
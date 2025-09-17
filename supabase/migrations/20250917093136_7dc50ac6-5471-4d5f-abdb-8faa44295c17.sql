-- Update the RLS policy to allow admins and employees to view all attorneys
DROP POLICY IF EXISTS "Users can view attorneys from their law firm" ON attorneys;

CREATE POLICY "Users can view attorneys from their law firm or all if admin/employee" 
ON attorneys 
FOR SELECT 
USING (
  -- Allow system admin access
  is_system_admin() OR 
  -- Allow admin and employee users to see all attorneys
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'employee')
  )) OR
  -- Allow regular users to see only their law firm's attorneys
  (law_firm_id = get_current_user_law_firm())
);
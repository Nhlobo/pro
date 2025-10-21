-- Update the attorneys RLS policy to allow employees to see all attorneys
DROP POLICY IF EXISTS "Role-based attorney access" ON attorneys;

CREATE POLICY "Role-based attorney access" ON attorneys
  FOR SELECT
  USING (
    is_system_admin() 
    OR (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'employee')
    ))
    OR (law_firm_id = get_current_user_law_firm())
  );
-- Fix RLS policy to allow admins/employees to see all attorneys
DROP POLICY IF EXISTS "Role-based attorney access" ON attorneys;

CREATE POLICY "Role-based attorney access" ON attorneys
  FOR SELECT
  USING (
    -- System admin can see all
    is_system_admin() 
    -- Admin and employee roles can see all attorneys
    OR (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'employee')
    ))
    -- Regular users can see attorneys from their law firm
    OR (law_firm_id = get_current_user_law_firm())
  );

-- Also ensure other operations are allowed for admins/employees
CREATE POLICY "Admins and employees can manage attorneys" ON attorneys
  FOR ALL
  USING (
    is_system_admin()
    OR (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'employee')
    ))
  );
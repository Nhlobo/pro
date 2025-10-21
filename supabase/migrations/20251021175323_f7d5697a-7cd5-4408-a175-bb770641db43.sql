-- Fix RLS policy to allow admins/employees to see all attorneys
DROP POLICY IF EXISTS "Role-based attorney access" ON attorneys;
DROP POLICY IF EXISTS "Admins and employees can manage attorneys" ON attorneys;
DROP POLICY IF EXISTS "Users can create attorneys for their law firm" ON attorneys;
DROP POLICY IF EXISTS "Users can delete attorneys from their law firm" ON attorneys;
DROP POLICY IF EXISTS "Users can update attorneys from their law firm" ON attorneys;

-- Allow SELECT for admins, employees, and users from same law firm
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

-- Allow INSERT for admins and employees (all attorneys)
CREATE POLICY "Admins employees can create attorneys" ON attorneys
  FOR INSERT
  WITH CHECK (
    is_system_admin()
    OR (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'employee')
    ))
  );

-- Allow UPDATE for admins and employees (all attorneys)
CREATE POLICY "Admins employees can update attorneys" ON attorneys
  FOR UPDATE
  USING (
    is_system_admin()
    OR (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'employee')
    ))
  );

-- Allow DELETE for admins and employees (all attorneys)
CREATE POLICY "Admins employees can delete attorneys" ON attorneys
  FOR DELETE
  USING (
    is_system_admin()
    OR (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'employee')
    ))
  );

-- Delete Lufuno Ngomani attorney
DELETE FROM attorneys WHERE id = '74b0658d-3a4c-4537-b2a7-8e1febd234d8';
-- Drop the overly permissive policy that allows all authenticated users to see all attorneys
DROP POLICY IF EXISTS "Authenticated users can view all attorneys" ON attorneys;

-- Create a new conditional policy for viewing attorneys
-- Admins can see all attorneys, regular users can only see attorneys from their law firm
CREATE POLICY "Role-based attorney access"
ON attorneys
FOR SELECT
USING (
  -- System admins can see all attorneys
  is_system_admin()
  OR
  -- Regular admins can see all attorneys
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  OR
  -- Regular users can only see attorneys from their own law firm
  (
    law_firm_id = get_current_user_law_firm()
  )
);
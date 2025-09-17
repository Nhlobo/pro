-- Remove the problematic RPC function since we're not using it anymore
DROP FUNCTION IF EXISTS get_all_attorneys_for_admin();

-- Update the RLS policy in a simpler way to allow admins and employees to see all attorneys
DROP POLICY IF EXISTS "Users can view attorneys from their law firm or all if admin/employee" ON attorneys;

-- Create new policy that allows admin/employee access to all attorneys
CREATE POLICY "Admin employees view all attorneys others view law firm only" 
ON attorneys FOR SELECT USING (
  -- System admin can see all
  is_system_admin() OR
  -- Check if user has admin or employee role
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'employee')
    AND created_at IS NOT NULL
  )) OR
  -- Regular users see only their law firm's attorneys  
  (law_firm_id = get_current_user_law_firm())
);
-- Update RLS policy to allow all authenticated users to view all attorneys
-- This is needed for AOD document management where users need to select from all attorneys

DROP POLICY IF EXISTS "Admin employees view all attorneys others view law firm only" ON attorneys;

CREATE POLICY "Authenticated users can view all attorneys"
ON attorneys
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

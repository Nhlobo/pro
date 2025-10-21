-- Drop the restrictive law firm policy that's blocking attorney visibility
DROP POLICY IF EXISTS "Users can view attorneys from their law firm" ON attorneys;

-- The "Authenticated users can view all attorneys" policy will remain active
-- This allows all authenticated users to see all attorneys in the system
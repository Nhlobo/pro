-- Temporarily update expert_reports RLS policies to be more permissive for debugging

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view reports for their law firm" ON expert_reports;
DROP POLICY IF EXISTS "Users can create reports for their law firm" ON expert_reports;
DROP POLICY IF EXISTS "Users can update reports for their law firm" ON expert_reports;
DROP POLICY IF EXISTS "Users can delete reports for their law firm" ON expert_reports;

-- Create more permissive policies that allow authenticated users to access reports
CREATE POLICY "Authenticated users can view expert reports" 
ON expert_reports 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create expert reports" 
ON expert_reports 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update expert reports" 
ON expert_reports 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete expert reports" 
ON expert_reports 
FOR DELETE 
USING (auth.uid() IS NOT NULL);
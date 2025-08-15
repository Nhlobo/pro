-- CRITICAL SECURITY FIX: Restrict access to medical experts to authenticated users only
-- This prevents public access to sensitive personal information

-- Remove the overly permissive policy that allows anyone to view medical experts
DROP POLICY IF EXISTS "Anyone can view medical experts directory" ON public.medical_experts;

-- Create a new policy that requires authentication to view medical experts
CREATE POLICY "Authenticated users can view medical experts directory"
ON public.medical_experts
FOR SELECT
TO authenticated
USING (true);

-- Also update the insert policy to be more restrictive (only authenticated users)
DROP POLICY IF EXISTS "Allow anon and authenticated to create medical experts" ON public.medical_experts;
CREATE POLICY "Authenticated users can create medical experts"
ON public.medical_experts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Note: This will require users to be logged in to view the medical expert directory
-- The application will need authentication to be implemented
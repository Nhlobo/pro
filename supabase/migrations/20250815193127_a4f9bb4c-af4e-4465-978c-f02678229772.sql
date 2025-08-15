-- Fix RLS so inserts can return representation and not fail
-- 1) Relax SELECT to allow anon + authenticated to read medical_experts
DROP POLICY IF EXISTS "Authenticated users can view medical experts directory" ON public.medical_experts;
CREATE POLICY "Anyone can view medical experts directory"
ON public.medical_experts
FOR SELECT
TO anon, authenticated
USING (true);

-- 2) Make INSERT explicit for anon + authenticated (some environments ignore PUBLIC)
DROP POLICY IF EXISTS "Allow all users to create medical experts" ON public.medical_experts;
CREATE POLICY "Allow anon and authenticated to create medical experts"
ON public.medical_experts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
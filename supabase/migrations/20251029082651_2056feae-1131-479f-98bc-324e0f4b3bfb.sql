-- Drop existing policies on medical_experts
DROP POLICY IF EXISTS "Admin and employee full access to medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "System admins full access to medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Users can view medical experts directory" ON public.medical_experts;
DROP POLICY IF EXISTS "Medical experts are viewable by authenticated users" ON public.medical_experts;
DROP POLICY IF EXISTS "Only admins can update medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Only admins can delete medical experts" ON public.medical_experts;
DROP POLICY IF EXISTS "Only admins can insert medical experts" ON public.medical_experts;

-- Create a single permissive policy that allows all operations for authenticated users
CREATE POLICY "Authenticated users full access to medical experts"
ON public.medical_experts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also create a policy specifically for system admins as a backup
CREATE POLICY "System admin bypass for medical experts"
ON public.medical_experts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'admin' OR profiles.role = 'admin')
  )
  OR has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'admin' OR profiles.role = 'admin')
  )
  OR has_role(auth.uid(), 'admin')
);
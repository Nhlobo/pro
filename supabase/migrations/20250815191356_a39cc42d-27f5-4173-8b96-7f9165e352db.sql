-- Allow users to insert their own profile (needed for signup)
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Temporarily allow all users to create medical experts
DROP POLICY IF EXISTS "Only admins can create medical experts" ON public.medical_experts;

CREATE POLICY "Allow all users to create medical experts" 
ON public.medical_experts 
FOR INSERT 
WITH CHECK (true);
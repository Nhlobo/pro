-- Temporarily disable RLS on profiles to fix immediate recursion issue
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Primary admin access" ON public.profiles;  
DROP POLICY IF EXISTS "Additional admin access" ON public.profiles;
-- Add admin-friendly RLS policies for profiles
-- Allow admins to view all profiles
CREATE POLICY IF NOT EXISTS "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  public.get_current_user_role() = 'admin' OR auth.uid() = id
);

-- Allow admins to update all profiles
CREATE POLICY IF NOT EXISTS "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (
  public.get_current_user_role() = 'admin' OR auth.uid() = id
)
WITH CHECK (
  public.get_current_user_role() = 'admin' OR auth.uid() = id
);

-- Create RLS policy to allow admins to delete user profiles
CREATE POLICY "Admins can delete user profiles"
ON public.profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS admin_profile
    WHERE admin_profile.id = auth.uid() 
    AND admin_profile.role = 'admin'
  )
);
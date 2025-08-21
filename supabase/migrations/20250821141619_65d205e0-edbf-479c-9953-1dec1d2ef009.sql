-- Update RLS policies for targets table to restrict edit/delete to admins only

-- Drop existing update and delete policies
DROP POLICY IF EXISTS "Users can update targets from their law firm" ON public.targets;
DROP POLICY IF EXISTS "Users can delete targets from their law firm" ON public.targets;

-- Create new admin-only policies for update and delete
CREATE POLICY "Only admins can update targets" 
ON public.targets 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can delete targets" 
ON public.targets 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
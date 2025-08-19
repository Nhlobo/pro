-- Update the admin user role
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'boshomane@kutlwanoassociate.com';

-- Create permissions table for role-based access control
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_name)
);

-- Enable RLS on permissions table
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for permissions table
CREATE POLICY "Admins can manage all permissions" 
ON public.user_permissions 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (user_id = auth.uid());

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(permission_name TEXT)
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions 
    WHERE user_id = auth.uid() 
    AND permission_name = $1 
    AND granted = true
  ) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
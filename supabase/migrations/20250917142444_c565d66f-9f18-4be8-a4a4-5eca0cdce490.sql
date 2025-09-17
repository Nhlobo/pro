-- Create function permissions system
CREATE TABLE public.function_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_category TEXT NOT NULL,
  function_name TEXT NOT NULL,
  sub_function TEXT,
  granted BOOLEAN NOT NULL DEFAULT false,
  user_type TEXT NOT NULL, -- 'referring_attorney' or 'employee'
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, function_category, function_name, sub_function)
);

-- Enable RLS
ALTER TABLE public.function_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all function permissions" 
ON public.function_permissions 
FOR ALL 
USING (is_system_admin());

CREATE POLICY "Users can view their own function permissions" 
ON public.function_permissions 
FOR SELECT 
USING (user_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_function_permissions_updated_at
BEFORE UPDATE ON public.function_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default function structure for different user types
-- Medical Expert Management functions
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Medical Expert Management' as function_category,
  unnest(ARRAY['View Experts', 'Add Expert', 'Edit Expert', 'Delete Expert']) as function_name,
  NULL as sub_function,
  false as granted,
  COALESCE(p.user_type, 'employee') as user_type
FROM profiles p 
WHERE p.user_type IN ('referring_attorney', 'employee');

-- Sub-functions for View Experts
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Medical Expert Management' as function_category,
  'View Experts' as function_name,
  unnest(ARRAY['View Contact Details', 'View Fees', 'View CV', 'View Availability']) as sub_function,
  false as granted,
  COALESCE(p.user_type, 'employee') as user_type
FROM profiles p 
WHERE p.user_type IN ('referring_attorney', 'employee');

-- Appointment Management functions
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Appointment Management' as function_category,
  unnest(ARRAY['View Appointments', 'Schedule Appointment', 'Edit Appointment', 'Cancel Appointment']) as function_name,
  NULL as sub_function,
  false as granted,
  COALESCE(p.user_type, 'employee') as user_type
FROM profiles p 
WHERE p.user_type IN ('referring_attorney', 'employee');

-- Sub-functions for appointment management
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Appointment Management' as function_category,
  'View Appointments' as function_name,
  unnest(ARRAY['View Payment Status', 'View Expert Details', 'Download Reports']) as sub_function,
  false as granted,
  COALESCE(p.user_type, 'employee') as user_type
FROM profiles p 
WHERE p.user_type IN ('referring_attorney', 'employee');

-- Report Management functions
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Report Management' as function_category,
  unnest(ARRAY['View Reports', 'Track Report Status', 'Download Reports', 'Request Report Changes']) as function_name,
  NULL as sub_function,
  false as granted,
  COALESCE(p.user_type, 'employee') as user_type
FROM profiles p 
WHERE p.user_type IN ('referring_attorney', 'employee');

-- Sub-functions for reports
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Report Management' as function_category,
  'View Reports' as function_name,
  unnest(ARRAY['View Expert Performance', 'View Financial Summary', 'Export to PDF']) as sub_function,
  false as granted,
  COALESCE(p.user_type, 'employee') as user_type
FROM profiles p 
WHERE p.user_type IN ('referring_attorney', 'employee');

-- Claimant Management functions (mostly for employees)
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Claimant Management' as function_category,
  unnest(ARRAY['View Claimants', 'Add Claimant', 'Edit Claimant', 'Delete Claimant']) as function_name,
  NULL as sub_function,
  false as granted,
  p.user_type
FROM profiles p 
WHERE p.user_type = 'employee';

-- Document Management functions
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Document Management' as function_category,
  unnest(ARRAY['Upload Documents', 'View Documents', 'Download Documents', 'Delete Documents']) as function_name,
  NULL as sub_function,
  false as granted,
  COALESCE(p.user_type, 'employee') as user_type
FROM profiles p 
WHERE p.user_type IN ('referring_attorney', 'employee');

-- Analytics and Reporting functions (mostly for employees)
INSERT INTO public.function_permissions (user_id, function_category, function_name, sub_function, granted, user_type) 
SELECT 
  p.id as user_id,
  'Analytics & Reporting' as function_category,
  unnest(ARRAY['View Analytics Dashboard', 'Generate Reports', 'Export Data', 'View Performance Metrics']) as function_name,
  NULL as sub_function,
  false as granted,
  p.user_type
FROM profiles p 
WHERE p.user_type = 'employee';

-- Create function to get user function permissions
CREATE OR REPLACE FUNCTION public.get_user_function_permissions(target_user_id UUID)
RETURNS TABLE(
  function_category TEXT,
  function_name TEXT,
  sub_function TEXT,
  granted BOOLEAN,
  user_type TEXT
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    fp.function_category,
    fp.function_name,
    fp.sub_function,
    fp.granted,
    fp.user_type
  FROM public.function_permissions fp
  WHERE fp.user_id = target_user_id
  AND (
    -- Admin can see all
    is_system_admin()
    OR 
    -- Users can see their own permissions
    fp.user_id = auth.uid()
  )
  ORDER BY fp.function_category, fp.function_name, fp.sub_function NULLS FIRST;
$$;
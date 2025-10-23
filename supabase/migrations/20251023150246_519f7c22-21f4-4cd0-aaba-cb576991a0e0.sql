-- Fix system administrator and employee structure
-- Kutlwano Associate is the company, not a law firm

-- Step 1: Update profiles for system admins and employees to have NULL law_firm_id
UPDATE public.profiles
SET law_firm_id = NULL
WHERE role IN ('admin', 'employee')
  AND law_firm_id IN (
    SELECT id FROM public.law_firms WHERE name ILIKE '%Kutlwano%'
  );

-- Step 2: Add a comment to law_firms table to clarify
COMMENT ON TABLE public.law_firms IS 'Stores client law firms only. System administrators and employees should have law_firm_id = NULL in profiles table.';

-- Step 3: Update RLS policies to properly handle NULL law_firm_id for admins/employees

-- Update the get_current_user_law_firm function to handle NULL for admins
CREATE OR REPLACE FUNCTION public.get_current_user_law_firm()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT law_firm_id
  FROM profiles
  WHERE id = auth.uid()
$$;

-- Step 4: Add a helper function to check if user is system admin/employee
CREATE OR REPLACE FUNCTION public.is_company_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'employee')
      AND law_firm_id IS NULL
  )
$$;

-- Step 5: Update attorney access policy to use the new function
DROP POLICY IF EXISTS "Role-based attorney access" ON public.attorneys;

CREATE POLICY "Role-based attorney access"
ON public.attorneys
FOR SELECT
TO authenticated
USING (
  is_system_admin() 
  OR is_company_user()
  OR law_firm_id = get_current_user_law_firm()
);

-- Step 6: Add policy for admins/employees to manage attorneys
DROP POLICY IF EXISTS "Admins employees can create attorneys" ON public.attorneys;
DROP POLICY IF EXISTS "Admins employees can update attorneys" ON public.attorneys;
DROP POLICY IF EXISTS "Admins employees can delete attorneys" ON public.attorneys;

CREATE POLICY "Company users can create attorneys"
ON public.attorneys
FOR INSERT
TO authenticated
WITH CHECK (
  is_system_admin() OR is_company_user()
);

CREATE POLICY "Company users can update attorneys"
ON public.attorneys
FOR UPDATE
TO authenticated
USING (is_system_admin() OR is_company_user());

CREATE POLICY "Company users can delete attorneys"
ON public.attorneys
FOR DELETE
TO authenticated
USING (is_system_admin() OR is_company_user());

-- Step 7: Mark Kutlwano Associate as inactive or add a flag
ALTER TABLE public.law_firms 
ADD COLUMN IF NOT EXISTS is_system_company boolean DEFAULT false;

UPDATE public.law_firms
SET is_system_company = true
WHERE name ILIKE '%Kutlwano%';

COMMENT ON COLUMN public.law_firms.is_system_company IS 'True if this is the system company (Kutlwano Associate), not a client law firm. Should not be used for regular operations.';
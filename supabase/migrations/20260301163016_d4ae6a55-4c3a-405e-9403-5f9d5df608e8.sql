-- Add sales_consultant to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_consultant';

-- Update profiles check constraint to allow sales_consultant role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'employee', 'sales_consultant'));
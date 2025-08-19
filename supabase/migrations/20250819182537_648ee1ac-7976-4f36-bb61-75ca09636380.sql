-- Remove security definer view and use a cleaner approach
DROP VIEW IF EXISTS public.medical_experts_discovery;

-- The function approach is cleaner and the RLS policy on medical_experts table is now properly restrictive
-- Keep the discovery function but remove the SECURITY DEFINER to avoid security warnings

-- Update the discovery function to not use SECURITY DEFINER
DROP FUNCTION IF EXISTS public.get_experts_for_discovery();

-- Instead, we'll rely on the restrictive RLS policy and update the app to handle discovery differently
-- The policy now only allows viewing experts with appointments or for admin users
-- For discovery, we'll need a different approach in the application layer
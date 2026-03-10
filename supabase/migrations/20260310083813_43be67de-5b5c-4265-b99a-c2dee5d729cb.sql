-- Remove the sales consultant appointments access policy
DROP POLICY IF EXISTS "Sales consultants can view all appointments" ON public.appointments;
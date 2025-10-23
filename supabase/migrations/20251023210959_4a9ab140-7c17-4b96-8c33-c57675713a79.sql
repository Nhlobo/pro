-- Remove attorney_id columns from tables
-- These are being replaced with referring_attorney text field

-- First, drop the policy that depends on attorney_id
DROP POLICY IF EXISTS "Users can view appointments by attorney" ON public.appointments;

-- Now remove attorney_id from appointments table
ALTER TABLE public.appointments DROP COLUMN IF EXISTS attorney_id;

-- Remove attorney_id from aod_documents table if it exists
ALTER TABLE public.aod_documents DROP COLUMN IF EXISTS attorney_id;

-- Remove attorney_id from short_term_agreements table if it exists
ALTER TABLE public.short_term_agreements DROP COLUMN IF EXISTS attorney_id;
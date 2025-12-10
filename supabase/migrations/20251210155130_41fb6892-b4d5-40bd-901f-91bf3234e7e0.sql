-- Add consultation fee columns for MVA, Med Neg, and Per Hour
ALTER TABLE public.medical_experts 
ADD COLUMN IF NOT EXISTS consultation_fee_mva numeric,
ADD COLUMN IF NOT EXISTS consultation_fee_med_neg numeric,
ADD COLUMN IF NOT EXISTS consultation_fee_per_hour numeric;
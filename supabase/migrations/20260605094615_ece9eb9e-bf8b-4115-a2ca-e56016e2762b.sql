ALTER TABLE public.medical_experts
  ADD COLUMN IF NOT EXISTS addendum_fees numeric,
  ADD COLUMN IF NOT EXISTS affidavit_fees numeric,
  ADD COLUMN IF NOT EXISTS joint_minutes_fees numeric;
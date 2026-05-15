
ALTER TABLE public.medical_experts
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS hpcsa_number TEXT,
  ADD COLUMN IF NOT EXISTS practice_number TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS assessment_turnaround_days INTEGER,
  ADD COLUMN IF NOT EXISTS report_turnaround_days INTEGER,
  ADD COLUMN IF NOT EXISTS virtual_assessment BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS medico_legal_only BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS medico_legal_years_experience INTEGER;

CREATE INDEX IF NOT EXISTS idx_medical_experts_province_city ON public.medical_experts(province, city);
CREATE INDEX IF NOT EXISTS idx_medical_experts_expert_type ON public.medical_experts(expert_type);

-- Add matter_types field to medical_experts table to track MVA and/or Med Neg
ALTER TABLE public.medical_experts
ADD COLUMN matter_types text[] DEFAULT ARRAY['MVA', 'Med Neg'];

COMMENT ON COLUMN public.medical_experts.matter_types IS 'Types of matters the expert handles: MVA, Med Neg, or both';
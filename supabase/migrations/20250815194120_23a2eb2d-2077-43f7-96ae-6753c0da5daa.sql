-- Add status field to medical_experts table to track active/inactive experts
ALTER TABLE public.medical_experts 
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Add index for better performance when filtering by status
CREATE INDEX idx_medical_experts_status ON public.medical_experts(status);
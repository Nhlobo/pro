
-- Add foreign key constraints to appointments table to enable proper joins

-- Add foreign key for claimant_id
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_claimant_id_fkey
FOREIGN KEY (claimant_id)
REFERENCES public.claimants(id)
ON DELETE CASCADE;

-- Add foreign key for expert_id (medical_experts)
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_expert_id_fkey
FOREIGN KEY (expert_id)
REFERENCES public.medical_experts(id)
ON DELETE CASCADE;

-- Add foreign key for referring_attorney_id
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_referring_attorney_id_fkey
FOREIGN KEY (referring_attorney_id)
REFERENCES public.referring_attorneys(id)
ON DELETE CASCADE;

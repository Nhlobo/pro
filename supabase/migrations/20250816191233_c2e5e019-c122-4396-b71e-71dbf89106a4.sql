-- Add missing foreign keys so PostgREST relationships work
ALTER TABLE public.expert_reports
  ADD CONSTRAINT expert_reports_expert_id_fkey
    FOREIGN KEY (expert_id)
    REFERENCES public.medical_experts(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT expert_reports_claimant_id_fkey
    FOREIGN KEY (claimant_id)
    REFERENCES public.claimants(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT expert_reports_appointment_id_fkey
    FOREIGN KEY (appointment_id)
    REFERENCES public.appointments(id)
    ON DELETE SET NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_expert_reports_expert_id ON public.expert_reports(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_reports_claimant_id ON public.expert_reports(claimant_id);
CREATE INDEX IF NOT EXISTS idx_expert_reports_appointment_id ON public.expert_reports(appointment_id);

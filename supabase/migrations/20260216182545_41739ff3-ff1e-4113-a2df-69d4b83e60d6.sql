
-- Table to store appointment checklist entries (attendance & sign-off)
CREATE TABLE public.appointment_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending','attended','missed','cancelled')),
  coordinator_signoff_name TEXT,
  coordinator_signoff_at TIMESTAMPTZ,
  manager_signoff_name TEXT,
  manager_signoff_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

-- Enable RLS
ALTER TABLE public.appointment_checklist ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can view checklist"
  ON public.appointment_checklist FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert
CREATE POLICY "Authenticated users can insert checklist"
  ON public.appointment_checklist FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update
CREATE POLICY "Authenticated users can update checklist"
  ON public.appointment_checklist FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Auto-update timestamp trigger
CREATE TRIGGER update_appointment_checklist_updated_at
  BEFORE UPDATE ON public.appointment_checklist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

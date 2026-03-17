-- Add medical_expert role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'medical_expert';

-- Add expert_id to profiles for linking expert users to medical_experts records
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expert_id uuid REFERENCES public.medical_experts(id);

-- Create expert availability table
CREATE TABLE IF NOT EXISTS public.expert_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.medical_experts(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_available boolean DEFAULT true,
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(expert_id, date)
);

ALTER TABLE public.expert_availability ENABLE ROW LEVEL SECURITY;

-- Experts can manage their own availability
CREATE POLICY "Experts manage own availability" ON public.expert_availability
FOR ALL USING (
  expert_id = (SELECT expert_id FROM public.profiles WHERE id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'employee')
);

-- Helper function to get current user's expert_id
CREATE OR REPLACE FUNCTION public.get_current_user_expert_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT expert_id FROM profiles WHERE id = auth.uid();
$$;
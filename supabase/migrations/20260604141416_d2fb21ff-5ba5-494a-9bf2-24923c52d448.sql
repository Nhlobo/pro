
CREATE TABLE IF NOT EXISTS public.expert_fee_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.medical_experts(id) ON DELETE CASCADE,
  fee_field TEXT NOT NULL,
  old_value NUMERIC,
  new_value NUMERIC NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  source TEXT NOT NULL DEFAULT 'credit_control',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.expert_fee_change_history TO authenticated;
GRANT ALL ON public.expert_fee_change_history TO service_role;

ALTER TABLE public.expert_fee_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all fee history" ON public.expert_fee_change_history;
CREATE POLICY "Admins can view all fee history"
  ON public.expert_fee_change_history
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert their own fee history" ON public.expert_fee_change_history;
CREATE POLICY "Authenticated users can insert their own fee history"
  ON public.expert_fee_change_history
  FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_expert_fee_history_expert_created
  ON public.expert_fee_change_history(expert_id, created_at DESC);

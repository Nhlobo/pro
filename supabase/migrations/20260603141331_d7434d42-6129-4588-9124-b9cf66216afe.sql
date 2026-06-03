
CREATE TABLE public.expert_fee_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.medical_experts(id) ON DELETE CASCADE,
  fee_field TEXT NOT NULL,
  old_value NUMERIC,
  new_value NUMERIC,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expert_fee_history_expert ON public.expert_fee_history(expert_id, changed_at DESC);

GRANT SELECT, INSERT ON public.expert_fee_history TO authenticated;
GRANT ALL ON public.expert_fee_history TO service_role;

ALTER TABLE public.expert_fee_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Experts can view own fee history"
ON public.expert_fee_history FOR SELECT
TO authenticated
USING (
  expert_id IN (SELECT expert_id FROM public.profiles WHERE id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "System inserts fee history"
ON public.expert_fee_history FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_expert_fee_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
BEGIN
  IF COALESCE(NEW.consultation_fee_mva, -1) IS DISTINCT FROM COALESCE(OLD.consultation_fee_mva, -1) THEN
    INSERT INTO public.expert_fee_history(expert_id, fee_field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'consultation_fee_mva', OLD.consultation_fee_mva, NEW.consultation_fee_mva, actor);
  END IF;
  IF COALESCE(NEW.consultation_fee_med_neg, -1) IS DISTINCT FROM COALESCE(OLD.consultation_fee_med_neg, -1) THEN
    INSERT INTO public.expert_fee_history(expert_id, fee_field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'consultation_fee_med_neg', OLD.consultation_fee_med_neg, NEW.consultation_fee_med_neg, actor);
  END IF;
  IF COALESCE(NEW.merit_fees, -1) IS DISTINCT FROM COALESCE(OLD.merit_fees, -1) THEN
    INSERT INTO public.expert_fee_history(expert_id, fee_field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'merit_fees', OLD.merit_fees, NEW.merit_fees, actor);
  END IF;
  IF COALESCE(NEW.consultation_fee_per_hour, -1) IS DISTINCT FROM COALESCE(OLD.consultation_fee_per_hour, -1) THEN
    INSERT INTO public.expert_fee_history(expert_id, fee_field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'consultation_fee_per_hour', OLD.consultation_fee_per_hour, NEW.consultation_fee_per_hour, actor);
  END IF;
  IF COALESCE(NEW.court_fees, -1) IS DISTINCT FROM COALESCE(OLD.court_fees, -1) THEN
    INSERT INTO public.expert_fee_history(expert_id, fee_field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'court_fees', OLD.court_fees, NEW.court_fees, actor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_expert_fee_changes ON public.medical_experts;
CREATE TRIGGER trg_log_expert_fee_changes
AFTER UPDATE ON public.medical_experts
FOR EACH ROW
EXECUTE FUNCTION public.log_expert_fee_changes();

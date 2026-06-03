
CREATE TYPE public.fee_review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.expert_fee_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID NOT NULL REFERENCES public.medical_experts(id) ON DELETE CASCADE,
  submitted_by UUID,
  fee_field TEXT NOT NULL,
  current_value NUMERIC,
  proposed_value NUMERIC NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status public.fee_review_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_efrr_expert ON public.expert_fee_review_requests(expert_id);
CREATE INDEX idx_efrr_status ON public.expert_fee_review_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_fee_review_requests TO authenticated;
GRANT ALL ON public.expert_fee_review_requests TO service_role;

ALTER TABLE public.expert_fee_review_requests ENABLE ROW LEVEL SECURITY;

-- Experts can view their own requests
CREATE POLICY "Experts view own fee review requests"
ON public.expert_fee_review_requests FOR SELECT TO authenticated
USING (
  expert_id IN (SELECT expert_id FROM public.profiles WHERE id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Experts can submit their own requests
CREATE POLICY "Experts create own fee review requests"
ON public.expert_fee_review_requests FOR INSERT TO authenticated
WITH CHECK (
  expert_id IN (SELECT expert_id FROM public.profiles WHERE id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Only admins can update (approve/reject); experts can cancel pending requests
CREATE POLICY "Admins update fee review requests"
ON public.expert_fee_review_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Experts delete own pending requests"
ON public.expert_fee_review_requests FOR DELETE TO authenticated
USING (
  status = 'pending'
  AND expert_id IN (SELECT expert_id FROM public.profiles WHERE id = auth.uid())
);

CREATE TRIGGER update_efrr_updated_at
BEFORE UPDATE ON public.expert_fee_review_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

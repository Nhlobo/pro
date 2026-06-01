-- Persist Expert Payment Planner snapshots so approval requests sync across users in realtime
CREATE TABLE IF NOT EXISTS public.expert_payment_planner_snapshots (
  id text PRIMARY KEY,
  label text NOT NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','not_approved')),
  submitted_for_approval_at timestamptz,
  submitted_by text,
  submitted_by_id uuid,
  approved_at timestamptz,
  approved_by text,
  approval_note text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_payment_planner_snapshots TO authenticated;
GRANT ALL ON public.expert_payment_planner_snapshots TO service_role;

ALTER TABLE public.expert_payment_planner_snapshots ENABLE ROW LEVEL SECURITY;

-- All authenticated internal staff can read planner snapshots
CREATE POLICY "Authenticated can view planner snapshots"
  ON public.expert_payment_planner_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Anyone authenticated can submit a snapshot for approval
CREATE POLICY "Authenticated can insert planner snapshots"
  ON public.expert_payment_planner_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Submitter can update their own snapshot; admins can update any
CREATE POLICY "Submitter or admin can update planner snapshots"
  ON public.expert_payment_planner_snapshots FOR UPDATE
  TO authenticated
  USING (
    submitted_by_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    submitted_by_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Only admins can delete
CREATE POLICY "Admins can delete planner snapshots"
  ON public.expert_payment_planner_snapshots FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Keep updated_at fresh
CREATE TRIGGER trg_epp_snapshots_updated_at
  BEFORE UPDATE ON public.expert_payment_planner_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime broadcasts (table-level RLS gates row delivery)
ALTER TABLE public.expert_payment_planner_snapshots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expert_payment_planner_snapshots;

CREATE INDEX IF NOT EXISTS idx_epp_snapshots_status ON public.expert_payment_planner_snapshots(approval_status);
CREATE INDEX IF NOT EXISTS idx_epp_snapshots_created_at ON public.expert_payment_planner_snapshots(created_at DESC);
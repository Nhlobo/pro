
DROP POLICY IF EXISTS "Authenticated can insert planner snapshots" ON public.expert_payment_planner_snapshots;
CREATE POLICY "Submitter can insert planner snapshots"
ON public.expert_payment_planner_snapshots
FOR INSERT TO authenticated
WITH CHECK (submitted_by_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "System inserts fee history" ON public.expert_fee_history;
CREATE POLICY "Admins can insert fee history"
ON public.expert_fee_history
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

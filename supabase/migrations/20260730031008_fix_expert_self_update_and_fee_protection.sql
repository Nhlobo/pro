-- Fix: experts could not actually save their own profile (incl. fees) from
-- the Expert Portal.
--
-- Root cause: 20260317120035 added `profiles.expert_id` and
-- `get_current_user_expert_id()` so an expert could be linked to their own
-- `medical_experts` row, but no RLS UPDATE policy was ever added allowing
-- that expert to write to their own row. The only UPDATE policy on
-- `medical_experts` ("Admins and employees can update medical experts",
-- see 20260304124849) requires the admin or employee role.
--
-- Because ExpertProfile.tsx calls `.update(...).eq('id', expertId)` WITHOUT
-- `.select()`, PostgREST does not error when RLS filters the row out of the
-- UPDATE — it just reports 0 rows affected as if it succeeded. The app then
-- shows a "Profile Updated" / "fees have been saved" toast even though
-- nothing was written. This is exactly the "does not change price" symptom.
--
-- Fix has two parts:
--   1. Allow an authenticated expert to UPDATE their own medical_experts row.
--   2. Add a trigger that strips out any change to fee columns unless the
--      actor is an admin/employee. Fee changes must go through the existing
--      `expert_fee_review_requests` approval workflow (already built in
--      ExpertProfile.tsx / ExpertFeeReviewApprovals.tsx) — this is
--      defense-in-depth so a self-service edit can never silently move a fee
--      even if a future UI change re-introduces the field.

-- 1. Let an expert update their own record.
CREATE POLICY "Experts can update their own medical expert record"
ON public.medical_experts
FOR UPDATE
TO authenticated
USING (id = public.get_current_user_expert_id())
WITH CHECK (id = public.get_current_user_expert_id());

-- 2. Guard fee columns so only admins/employees (direct edits) or the
--    approval flow (which itself runs as an admin) can change them.
CREATE OR REPLACE FUNCTION public.protect_medical_expert_fee_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') THEN
    RETURN NEW;
  END IF;

  -- Non-admin/employee callers (e.g. an expert editing their own profile):
  -- silently keep fee fields at their previous value instead of blocking
  -- the whole update, so legitimate non-fee edits (contact info,
  -- availability notes, etc.) still save.
  NEW.consultation_fee_mva := OLD.consultation_fee_mva;
  NEW.consultation_fee_med_neg := OLD.consultation_fee_med_neg;
  NEW.merit_fees := OLD.merit_fees;
  NEW.consultation_fee_per_hour := OLD.consultation_fee_per_hour;
  NEW.consultation_fees := OLD.consultation_fees;
  NEW.court_fees := OLD.court_fees;
  NEW.addendum_fees := OLD.addendum_fees;
  NEW.affidavit_fees := OLD.affidavit_fees;
  NEW.joint_minutes_fees := OLD.joint_minutes_fees;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_medical_expert_fee_columns ON public.medical_experts;
CREATE TRIGGER trg_protect_medical_expert_fee_columns
BEFORE UPDATE ON public.medical_experts
FOR EACH ROW
EXECUTE FUNCTION public.protect_medical_expert_fee_columns();

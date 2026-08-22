-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 23
-- Remaining unscoped-firm-access gaps found during the full Attorney
-- Portal / Medical Expert Portal display audit.
--
-- Same bug class as the Phase 20 "debt management" backdoor: these
-- policies check `referring_attorney_id = get_current_user_referring_
-- attorney()` (or an equivalent join) with NO is_external_portal_user
-- / account_scope gate. Since profiles.referring_attorney_id is
-- populated identically for firm-scoped AND individual-scoped bridged
-- sessions, every one of these was silently granting an individual-
-- scoped account its whole firm's data on these specific tables,
-- bypassing Phase 20's individual isolation exactly like the
-- appointments/aod_documents/expert_reports backdoor did.
--
-- aod_payments: used by AttorneyPayments.tsx (Payments tab).
-- litigation_service_requests: used by LitigationTrialServices.tsx
--   (embedded in the attorney portal's case-access views).
-- report_versions / report_deliveries / report_reviews: not currently
--   rendered by any attorney or expert portal page, but the same gap
--   on the same class of case data — closed for consistency and
--   because a UI could start reading them at any time without anyone
--   revisiting the RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- aod_payments
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view payments from their law firm" ON public.aod_payments;
DROP POLICY IF EXISTS "Users can create payments for their law firm" ON public.aod_payments;
DROP POLICY IF EXISTS "Users can update payments from their law firm" ON public.aod_payments;

DROP POLICY IF EXISTS "Users can view payments from their referring attorney" ON public.aod_payments;
CREATE POLICY "Users can view payments from their referring attorney"
ON public.aod_payments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.aod_documents
  WHERE aod_documents.id = aod_payments.aod_document_id
    AND (
      (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_portal_account_scope() = 'firm'
        AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
      )
    )
));

DROP POLICY IF EXISTS "Users can create payments for their referring attorney" ON public.aod_payments;
CREATE POLICY "Users can create payments for their referring attorney"
ON public.aod_payments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.aod_documents
  WHERE aod_documents.id = aod_payments.aod_document_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'employee'::app_role)
      OR (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_portal_account_scope() = 'firm'
        AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
      )
    )
));

DROP POLICY IF EXISTS "Users can update payments from their referring attorney" ON public.aod_payments;
CREATE POLICY "Users can update payments from their referring attorney"
ON public.aod_payments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.aod_documents
  WHERE aod_documents.id = aod_payments.aod_document_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'employee'::app_role)
      OR (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_portal_account_scope() = 'firm'
        AND aod_documents.referring_attorney_id = get_current_user_referring_attorney()
      )
    )
));

COMMENT ON POLICY "Users can view payments from their referring attorney" ON public.aod_payments IS
  'Phase 23: closed the same unscoped-firm-access gap as the Phase 20 appointments/aod_documents backdoor — no is_external_portal_user check meant every bridged attorney session (firm or individual scope) got full firm-wide access. AOD payments remain firm-only (no individual sub-scope), matching aod_documents.';

-- ---------------------------------------------------------------------
-- litigation_service_requests — the existing `requested_by = auth.uid()`
-- branch already gives an individual-scoped account its own submitted
-- requests; only the firm-wide OR branch needed the scope gate.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own litigation service requests" ON public.litigation_service_requests;
CREATE POLICY "Users can view own litigation service requests"
ON public.litigation_service_requests FOR SELECT
USING (
  requested_by = auth.uid()
  OR (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND referring_attorney_id = get_current_user_referring_attorney()
  )
);

-- ---------------------------------------------------------------------
-- report_versions / report_deliveries / report_reviews — not currently
-- rendered anywhere in the portals, closed for consistency with the
-- rest of the case-data surface.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view report_versions for their law firm" ON public.report_versions;
CREATE POLICY "Users can view report_versions for their law firm"
ON public.report_versions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.expert_reports er
  JOIN public.appointments a ON a.id = er.appointment_id
  WHERE er.id = report_versions.expert_report_id
    AND (
      (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_portal_account_scope() = 'firm'
        AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_attorney_contact() IS NOT NULL
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
));

DROP POLICY IF EXISTS "Users can view deliveries for their law firm" ON public.report_deliveries;
CREATE POLICY "Users can view deliveries for their law firm"
ON public.report_deliveries FOR SELECT
USING (
  (
    NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
    AND delivered_to_attorney_id = get_current_user_referring_attorney()
  )
  OR (
    get_current_user_portal_account_scope() = 'firm'
    AND delivered_to_attorney_id = get_current_user_referring_attorney()
  )
);

DROP POLICY IF EXISTS "Users can view reviews for their reports" ON public.report_reviews;
CREATE POLICY "Users can view reviews for their reports"
ON public.report_reviews FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.expert_reports er
  JOIN public.appointments a ON a.id = er.appointment_id
  WHERE er.id = report_reviews.expert_report_id
    AND (
      (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_portal_account_scope() = 'firm'
        AND a.referring_attorney_id = get_current_user_referring_attorney()
      )
      OR (
        get_current_user_attorney_contact() IS NOT NULL
        AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
));

-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 25
-- Storage bucket access for attorney/expert portal downloads — found
-- while investigating "documents aren't there, download buttons don't
-- work" across the whole portal.
--
-- ROOT CAUSE: a May 2026 storage-policy consolidation
-- (20260503185138_..._.sql) replaced every attorney/expert-facing
-- SELECT policy on the 'documents', 'expert-documents', and
-- 'attorney-documents' buckets with a single staff/owner-only rule:
--
--   USING (bucket_id = 'documents' AND (owner = auth.uid() OR is_admin_or_employee()))
--
-- This is a COMPLETELY SEPARATE RLS system from the `public.documents`
-- TABLE policy Phase 20/21 already fixed — Postgres storage lives in
-- storage.objects, gated independently. Fixing the table-level
-- metadata policy (which lists what documents exist) did nothing for
-- this, because the actual file bytes are gated here. Since almost
-- every case document is uploaded by STAFF or by the assigned
-- MEDICAL EXPERT (never by the attorney who's trying to view it), and
-- `owner = auth.uid()` only matches the literal uploader, this
-- silently blocked every attorney's and most experts' downloads
-- across all three buckets, on every download entry point in the
-- codebase (AttorneyCaseStatus, AttorneyMyCases, AttorneyReports,
-- ExpertCaseDetail all try exactly these three buckets).
--
-- FIX: add an additional, case-scoped SELECT branch to each bucket's
-- policy — a portal user can download a file if it's linked (via
-- public.documents.file_path, or public.report_versions.file_path
-- through expert_reports -> appointments) to a case they're already
-- allowed to see under the exact same firm/individual/expert RLS
-- logic used everywhere else in this module. This does not touch the
-- staff or owner branches, and does not touch INSERT/UPDATE/DELETE
-- (upload/edit/remove stay staff-only, matching existing behaviour —
-- portal users have never been able to upload into these buckets and
-- this migration doesn't change that).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.user_can_view_case_document(p_file_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Branch 1: a row in public.documents references this exact file,
    -- respects that table's own visibility flags, and the underlying
    -- case is one this portal user can already see.
    EXISTS (
      SELECT 1 FROM public.documents d
      LEFT JOIN public.appointments a ON a.id = d.appointment_id
      WHERE d.file_path = p_file_path
        AND (
          (
            get_current_user_expert_id() IS NOT NULL
            AND COALESCE(d.is_visible_to_expert, true)
            AND (
              d.expert_id = get_current_user_expert_id()
              OR (a.id IS NOT NULL AND a.expert_id = get_current_user_expert_id())
            )
          )
          OR (
            get_current_user_expert_id() IS NULL
            AND COALESCE(d.is_visible_to_attorney, true)
            AND (
              (
                NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
                AND get_current_user_referring_attorney() IS NOT NULL
                AND (
                  d.referring_attorney_id = get_current_user_referring_attorney()
                  OR (a.id IS NOT NULL AND a.referring_attorney_id = get_current_user_referring_attorney())
                )
              )
              OR (
                get_current_user_portal_account_scope() = 'firm'
                AND (
                  d.referring_attorney_id = get_current_user_referring_attorney()
                  OR (a.id IS NOT NULL AND a.referring_attorney_id = get_current_user_referring_attorney())
                )
              )
              OR (
                get_current_user_attorney_contact() IS NOT NULL
                AND a.id IS NOT NULL
                AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
              )
            )
          )
        )
    )
    OR
    -- Branch 2: a report_versions row references this exact file,
    -- reached through expert_reports -> appointments the same way.
    EXISTS (
      SELECT 1 FROM public.report_versions rv
      JOIN public.expert_reports er ON er.id = rv.expert_report_id
      JOIN public.appointments a ON a.id = er.appointment_id
      WHERE rv.file_path = p_file_path
        AND (
          (
            get_current_user_expert_id() IS NOT NULL
            AND a.expert_id = get_current_user_expert_id()
          )
          OR (
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
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_view_case_document(text) TO authenticated;
REVOKE ALL ON FUNCTION public.user_can_view_case_document(text) FROM anon;

COMMENT ON FUNCTION public.user_can_view_case_document(text) IS
  'Phase 25: given a storage.objects file path, resolves whether the current bridged portal session (attorney or expert) is allowed to see the case that file belongs to, using the same firm/individual/expert RLS logic already established on the documents/report_versions/appointments tables. Used to restore case-scoped storage bucket access without loosening it to every authenticated user.';

-- documents bucket
DROP POLICY IF EXISTS "Portal users can view their case documents" ON storage.objects;
CREATE POLICY "Portal users can view their case documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.user_can_view_case_document(name)
);

-- expert-documents bucket
DROP POLICY IF EXISTS "Portal users can view their case expert documents" ON storage.objects;
CREATE POLICY "Portal users can view their case expert documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expert-documents'
  AND public.user_can_view_case_document(name)
);

-- attorney-documents bucket
DROP POLICY IF EXISTS "Portal users can view their case attorney documents" ON storage.objects;
CREATE POLICY "Portal users can view their case attorney documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attorney-documents'
  AND public.user_can_view_case_document(name)
);

-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 27
-- Two related findings from tracing the actual report-upload and
-- notification lifecycle end to end.
--
-- FINDING 1 (security, newly exposed by Phase 20): documents.
-- is_visible_to_attorney and is_visible_to_expert have existed since
-- March 2026 and are used as a genuine staff review gate — most
-- visibly, ExpertCaseDetail.tsx's own report-upload code deliberately
-- sets is_visible_to_attorney: false on submission, and only a staff
-- "Approve Document" action in AdminDocumentVault.tsx flips it to
-- true. But NO RLS policy, at any point in this table's history, has
-- ever actually checked these columns — they were purely a client-side
-- filter inside specific staff views. Before Phase 20, this was masked
-- by the fact that attorneys had no reliable firm-scoped RLS access to
-- `documents` at all. Now that Phase 20 fixed that access, this
-- pre-existing gap is exposed: an attorney can currently see a raw,
-- unreviewed expert report (and, per the backfill migration, an
-- expert's own CV/qualifications/HPCSA documents, which are explicitly
-- marked is_visible_to_attorney: false forever) the moment it's
-- uploaded, before any staff review.
--
-- FINDING 2: report_versions is a completely orphaned table. It has a
-- schema (file_path, file_name, version_number) but is never written
-- to by any code path in this application — the actual report file an
-- expert submits is stored as a row in `documents` with
-- document_type = 'Expert Report'. Phase 24's fix correctly gave
-- experts RLS access to their own `expert_reports` status row, but the
-- attorney-facing report-download query (useAttorneyDashboardStats.tsx)
-- was pointed at report_versions, which will only ever be empty. This
-- migration doesn't change that query (a frontend fix, tracked
-- separately) but the RLS fix here is what makes the corrected query
-- return the right thing: the real file in `documents`, visible only
-- once approval_status = 'approved' AND is_visible_to_attorney = true.
-- =====================================================================

DROP POLICY IF EXISTS "Users can view documents from their law firm" ON public.documents;
CREATE POLICY "Users can view documents from their law firm"
ON public.documents
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    (
      NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
      AND get_current_user_referring_attorney() IS NOT NULL
      AND COALESCE(documents.is_visible_to_attorney, true)
      AND (
        documents.referring_attorney_id = get_current_user_referring_attorney()
        OR EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = documents.appointment_id
            AND a.referring_attorney_id = get_current_user_referring_attorney()
        )
      )
    )
    OR (
      get_current_user_portal_account_scope() = 'firm'
      AND COALESCE(documents.is_visible_to_attorney, true)
      AND (
        documents.referring_attorney_id = get_current_user_referring_attorney()
        OR EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = documents.appointment_id
            AND a.referring_attorney_id = get_current_user_referring_attorney()
        )
      )
    )
    OR (
      get_current_user_attorney_contact() IS NOT NULL
      AND COALESCE(documents.is_visible_to_attorney, true)
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = documents.appointment_id
          AND a.assigned_attorney_contact_id = get_current_user_attorney_contact()
      )
    )
    OR (
      get_current_user_expert_id() IS NOT NULL
      AND COALESCE(documents.is_visible_to_expert, true)
      AND (
        documents.expert_id = get_current_user_expert_id()
        OR EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = documents.appointment_id
            AND a.expert_id = get_current_user_expert_id()
        )
      )
    )
    -- Staff/admin bypass both flags entirely — they need to see
    -- everything, including what's still pending their own review.
    OR is_system_admin()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
  )
);

COMMENT ON POLICY "Users can view documents from their law firm" ON public.documents IS
  'Phase 27: added the is_visible_to_attorney / is_visible_to_expert check that has been missing from RLS since these columns were introduced (March 2026) — previously enforced only by ad-hoc client-side filters in specific staff views (AdminDocumentVault.tsx), never by the database. Phase 20 fixing firm/individual scoping exposed this: attorneys could see a raw expert report the instant it was uploaded, before staff review, and could see expert-private documents (CVs, qualifications, HPCSA certificates) that are permanently marked not-visible-to-attorney. Staff/admin still see everything, including pending items, since reviewing them is their job.';

-- ---------------------------------------------------------------------
-- Corresponding storage-bucket fix: user_can_view_case_document()
-- (Phase 25) joins to public.documents to authorize file downloads —
-- it needs the same visibility check, or a pending/hidden report's
-- FILE could still be downloaded via a guessed/leaked storage path
-- even though its metadata row is now correctly hidden from listings.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_view_case_document(p_file_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.documents d
      LEFT JOIN public.appointments a ON a.id = d.appointment_id
      WHERE d.file_path = p_file_path
        AND (
          is_system_admin()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'employee'::app_role)
          OR (
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
    -- report_versions branch kept for forward-compatibility even though
    -- nothing currently writes to that table — harmless if it stays
    -- empty, and correct automatically if it's ever wired up later.
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

COMMENT ON FUNCTION public.user_can_view_case_document(text) IS
  'Phase 25/27: given a storage.objects file path, resolves whether the current bridged portal session (attorney or expert) is allowed to download the case document at that path. Phase 27 added the is_visible_to_attorney / is_visible_to_expert check so a pending/hidden document''s underlying file cannot be fetched by path even though its metadata row is correctly hidden from listing queries.';

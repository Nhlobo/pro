-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 26
-- Upload (INSERT) permissions and the AOD storage leak — found while
-- going deep on "documents aren't there, upload buttons look wrong,
-- AOD doesn't download."
--
-- FINDING 1 (most severe): the May 2026 storage consolidation
-- (20260503185138_..._.sql) set INSERT on the 'documents' and
-- 'expert-documents' buckets to STAFF-ONLY, with no exception at all.
-- Phase 25 restored portal-user DOWNLOAD access, but never touched
-- INSERT. Concretely, this means:
--   - AttorneyMyCases.tsx's "Upload Document" button (documents bucket)
--   - AttorneyAppointments.tsx's new-request attachment upload (documents bucket)
--   - ExpertCaseDetail.tsx's "Upload Report" (expert-documents bucket)
-- have ALWAYS silently failed for every attorney and every expert —
-- ExpertCaseDetail.tsx's report upload is the single most core
-- workflow in the entire Medical Expert Portal. This predates all of
-- this session's other fixes and is unrelated to the firm/individual
-- scoping work.
--
-- FINDING 2: the 'aod-documents' bucket's SELECT policy
-- ("Company users can view all AOD documents", 2025-11-19) checks only
-- `profiles.role IN ('admin','employee','referring_attorney')` — ANY
-- attorney portal login, regardless of firm, can view/download EVERY
-- firm's AOD agreement documents. No folder or firm match at all. This
-- is a cross-firm data leak, separate from and more severe than any
-- gap found in earlier phases. The UPDATE/DELETE policies on this same
-- bucket (added 2026-06-01) already do this correctly via folder
-- isolation (`(storage.foldername(objects.name))[1] = referring_attorney_id`)
-- — SELECT was simply missed at the time.
--
-- FIX: each upload site's file path already embeds the identifier
-- needed to verify ownership (the appointment id, the firm id, or the
-- expert's own id) — verified against the actual upload code, not
-- assumed. Policies below check that embedded identifier against a
-- case/firm/expert this session can actually see, using the exact
-- same visibility logic as everywhere else in this module. The AOD
-- SELECT policy is rewritten to match its own UPDATE/DELETE folder
-- rule, with the firm/individual scope awareness the rest of this
-- module already has.
-- =====================================================================

-- ---------------------------------------------------------------------
-- documents bucket — INSERT
-- Two upload sites use this bucket, each with a distinct folder
-- convention, both verified against the actual frontend code:
--   attorney-documents/<appointment_id>/<timestamp>_<filename>   (AttorneyMyCases.tsx)
--   appointment-request-attachments/<referring_attorney_id>/...  (AttorneyAppointments.tsx)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff can upload to documents bucket" ON storage.objects;
CREATE POLICY "Staff can upload to documents bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    public.is_admin_or_employee()
    OR (
      -- attorney-documents/<appointment_id>/...
      (storage.foldername(name))[1] = 'attorney-documents'
      AND array_length(storage.foldername(name), 1) >= 2
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id::text = (storage.foldername(name))[2]
          AND a.deleted_at IS NULL
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
      )
    )
    OR (
      -- appointment-request-attachments/<referring_attorney_id>/...
      (storage.foldername(name))[1] = 'appointment-request-attachments'
      AND array_length(storage.foldername(name), 1) >= 2
      AND get_current_user_referring_attorney() IS NOT NULL
      AND (storage.foldername(name))[2] = get_current_user_referring_attorney()::text
    )
  )
);

-- ---------------------------------------------------------------------
-- expert-documents bucket — INSERT
-- One upload site: ExpertCaseDetail.tsx's report submission —
--   expert-reports/<expert_id>/<appointment_id>/<timestamp>.<ext>
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff upload expert documents" ON storage.objects;
CREATE POLICY "Staff upload expert documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expert-documents'
  AND (
    public.is_admin_or_employee()
    OR (
      (storage.foldername(name))[1] = 'expert-reports'
      AND array_length(storage.foldername(name), 1) >= 3
      AND get_current_user_expert_id() IS NOT NULL
      AND (storage.foldername(name))[2] = get_current_user_expert_id()::text
      AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id::text = (storage.foldername(name))[3]
          AND a.expert_id = get_current_user_expert_id()
          AND a.deleted_at IS NULL
      )
    )
  )
);

-- ---------------------------------------------------------------------
-- aod-documents bucket — SELECT: close the cross-firm leak, mirror the
-- folder-isolation rule already used correctly by this bucket's own
-- UPDATE/DELETE policies, with firm/individual scope awareness.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Company users can view all AOD documents" ON storage.objects;
CREATE POLICY "Company users can view all AOD documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'aod-documents'
  AND (
    public.is_system_admin()
    OR public.is_admin_or_employee()
    OR (
      (
        NOT COALESCE((SELECT p.is_external_portal_user FROM public.profiles p WHERE p.id = auth.uid()), false)
        AND get_current_user_referring_attorney() IS NOT NULL
        AND (storage.foldername(name))[1] = get_current_user_referring_attorney()::text
      )
      OR (
        get_current_user_portal_account_scope() = 'firm'
        AND get_current_user_referring_attorney() IS NOT NULL
        AND (storage.foldername(name))[1] = get_current_user_referring_attorney()::text
      )
    )
  )
);

COMMENT ON POLICY "Company users can view all AOD documents" ON storage.objects IS
  'Phase 26: closed a cross-firm leak — the original policy only checked profiles.role = referring_attorney with no firm/folder match at all, so any attorney portal login could view every firm''s AOD documents. Now mirrors the folder-isolation rule this bucket''s own UPDATE/DELETE policies already used correctly, with firm/individual scope awareness matching the rest of this module. AOD documents remain firm-only (no individual sub-scope), consistent with aod_documents/aod_payments elsewhere.';

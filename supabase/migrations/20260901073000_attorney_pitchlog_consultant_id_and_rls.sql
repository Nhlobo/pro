-- attorney_pitchlog previously had no real link to a sales consultant --
-- only a free-text `sales_person` field (mostly first names, a few full
-- names, a handful of junk values like "In-House"), and RLS was
-- `has_role(auth.uid(), 'sales_consultant')` with no row scoping at all: any
-- sales consultant could read and write every other consultant's rows via
-- the API. `created_by` looked like a candidate for scoping but isn't
-- reliable -- the only real insert path (useSecureAssessments.tsx, fired
-- when an assessment gets a consultant assigned) never set it, and even
-- where populated it reflects who triggered the write (often an
-- admin/employee doing the scheduling), not who the deal is credited to.
--
-- Adds a real consultant_id FK, backfills it by matching sales_person to
-- sales_consultants.name (first-name or full-name, case-insensitive --
-- verified all 13 active consultants have unique first names, so this is
-- exact, not a guess: 3666/3685 rows matched cleanly, 19 junk values
-- ("In-House", "Kutlwano Associate", etc.) are left unmatched rather than
-- force-attributed), then replaces the single blanket ALL policy with
-- per-consultant SELECT/INSERT/UPDATE/DELETE policies. Admin/employee
-- access (a separate existing policy) is untouched.
--
-- Note: a repo-wide scan found the entire manual pitchlog-management UI
-- (src/components/pitchlog/: CsvUpload, ExcelUpload, InlineRow, AddRow,
-- PdfExport, ProvinceCoverage, SalesReport, WeeklySummary,
-- MarketingEmails -- 9 files) is not imported anywhere live. The only
-- real write path to this table is the auto-sync in
-- useSecureAssessments.tsx, patched in this same change to set
-- consultant_id directly and stop relying on name-matching for new rows.

ALTER TABLE public.attorney_pitchlog
  ADD COLUMN consultant_id uuid REFERENCES public.sales_consultants(id);

CREATE INDEX idx_attorney_pitchlog_consultant_id ON public.attorney_pitchlog(consultant_id);

UPDATE public.attorney_pitchlog ap
SET consultant_id = sc.id
FROM public.sales_consultants sc
WHERE ap.consultant_id IS NULL
  AND (
    lower(split_part(trim(sc.name), ' ', 1)) = lower(trim(ap.sales_person))
    OR lower(trim(sc.name)) = lower(trim(ap.sales_person))
  );

DROP POLICY IF EXISTS "Sales consultants can manage pitchlog" ON public.attorney_pitchlog;

CREATE POLICY "Sales consultants can view own pitchlog"
ON public.attorney_pitchlog FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sales_consultant'::app_role)
  AND consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
);

CREATE POLICY "Sales consultants can insert own pitchlog"
ON public.attorney_pitchlog FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'sales_consultant'::app_role)
  AND (
    consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
    OR consultant_id IS NULL
  )
);

CREATE POLICY "Sales consultants can update own pitchlog"
ON public.attorney_pitchlog FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'sales_consultant'::app_role)
  AND consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'sales_consultant'::app_role)
  AND consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
);

CREATE POLICY "Sales consultants can delete own pitchlog"
ON public.attorney_pitchlog FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'sales_consultant'::app_role)
  AND consultant_id IN (SELECT id FROM public.sales_consultants WHERE user_id = auth.uid())
);

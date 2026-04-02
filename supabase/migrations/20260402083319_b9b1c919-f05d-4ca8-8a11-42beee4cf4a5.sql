-- Move payments from docs being deleted to the kept (latest) doc per attorney
WITH latest_per_attorney AS (
  SELECT DISTINCT ON (referring_attorney_id) id, referring_attorney_id
  FROM aod_documents
  ORDER BY referring_attorney_id, created_at DESC
),
to_delete AS (
  SELECT id, referring_attorney_id FROM aod_documents
  WHERE id NOT IN (SELECT id FROM latest_per_attorney)
)
UPDATE aod_payments ap
SET aod_document_id = lpa.id
FROM to_delete td
JOIN latest_per_attorney lpa ON lpa.referring_attorney_id = td.referring_attorney_id
WHERE ap.aod_document_id = td.id;

-- Delete all but the latest AOD per attorney
DELETE FROM aod_documents
WHERE id NOT IN (
  SELECT DISTINCT ON (referring_attorney_id) id
  FROM aod_documents
  ORDER BY referring_attorney_id, created_at DESC
);

-- Drop old index and create stricter unique constraint: one AOD per attorney
DROP INDEX IF EXISTS uq_aod_attorney_value_reports;
CREATE UNIQUE INDEX IF NOT EXISTS uq_aod_per_attorney ON aod_documents (referring_attorney_id);
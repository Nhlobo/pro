-- First, move any payments from duplicate docs to the original (oldest) doc for the same attorney+value+reports
WITH originals AS (
  SELECT DISTINCT ON (referring_attorney_id, total_contract_value, total_reports_agreed) 
    id, referring_attorney_id, total_contract_value, total_reports_agreed
  FROM aod_documents 
  ORDER BY referring_attorney_id, total_contract_value, total_reports_agreed, created_at ASC
),
duplicates AS (
  SELECT ad.id as dupe_id, ad.referring_attorney_id, ad.total_contract_value, ad.total_reports_agreed
  FROM aod_documents ad
  WHERE ad.id NOT IN (SELECT id FROM originals)
)
UPDATE aod_payments ap
SET aod_document_id = o.id
FROM duplicates d
JOIN originals o ON o.referring_attorney_id = d.referring_attorney_id 
  AND o.total_contract_value = d.total_contract_value 
  AND o.total_reports_agreed = d.total_reports_agreed
WHERE ap.aod_document_id = d.dupe_id;

-- Delete duplicate AOD documents (keep the oldest per attorney+value+reports combo)
DELETE FROM aod_documents 
WHERE id NOT IN (
  SELECT DISTINCT ON (referring_attorney_id, total_contract_value, total_reports_agreed) id 
  FROM aod_documents 
  ORDER BY referring_attorney_id, total_contract_value, total_reports_agreed, created_at ASC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_aod_attorney_value_reports 
ON aod_documents (referring_attorney_id, total_contract_value, total_reports_agreed);
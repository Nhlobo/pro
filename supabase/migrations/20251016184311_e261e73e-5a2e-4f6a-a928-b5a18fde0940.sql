-- Add total_reports_agreed column to aod_documents table
ALTER TABLE public.aod_documents 
ADD COLUMN total_reports_agreed integer DEFAULT 0;

COMMENT ON COLUMN public.aod_documents.total_reports_agreed IS 'Total number of reports/assessments agreed upon in the contract';
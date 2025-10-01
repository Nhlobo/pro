-- Make record_id nullable in audit_logs for bulk operations
ALTER TABLE public.audit_logs 
ALTER COLUMN record_id DROP NOT NULL;
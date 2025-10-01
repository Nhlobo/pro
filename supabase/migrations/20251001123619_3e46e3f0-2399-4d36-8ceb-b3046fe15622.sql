-- First, update any existing invalid action_type values to 'DELETE'
UPDATE public.audit_logs 
SET action_type = 'DELETE' 
WHERE action_type NOT IN ('CREATE', 'UPDATE', 'DELETE');

-- Drop the old constraint
ALTER TABLE public.audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

-- Add new constraint that includes DELETE_ALL
ALTER TABLE public.audit_logs 
ADD CONSTRAINT audit_logs_action_type_check 
CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'DELETE_ALL'));
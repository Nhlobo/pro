-- Fix audit_logs constraints to support user deletion and system operations

-- 1. Make user_id nullable to support system-level operations like user deletion
ALTER TABLE public.audit_logs
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop the existing action_type check constraint
ALTER TABLE public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

-- 3. Add updated action_type check constraint with all valid values
ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_action_type_check 
CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'DELETE_ALL', 'SELECT', 'INSERT'));

-- 4. Add helpful comments
COMMENT ON COLUMN public.audit_logs.user_id IS 'User who performed the action. Can be NULL for system-level operations like user deletion where the user no longer exists.';
COMMENT ON COLUMN public.audit_logs.action_type IS 'Type of action performed. Valid values: CREATE, UPDATE, DELETE, DELETE_ALL, SELECT, INSERT';
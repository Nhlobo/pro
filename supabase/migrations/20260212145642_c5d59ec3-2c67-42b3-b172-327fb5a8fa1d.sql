
-- Fix foreign keys that reference auth.users without ON DELETE CASCADE or SET NULL
-- These block user deletion. Using SET NULL for "recorded_by", "created_by", etc. columns
-- since we want to preserve the records but allow user deletion.

ALTER TABLE public.aod_documents DROP CONSTRAINT aod_documents_uploaded_by_fkey;
ALTER TABLE public.aod_documents ADD CONSTRAINT aod_documents_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.aod_payments DROP CONSTRAINT aod_payments_recorded_by_fkey;
ALTER TABLE public.aod_payments ADD CONSTRAINT aod_payments_recorded_by_fkey 
  FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.appointments DROP CONSTRAINT appointments_deleted_by_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_deleted_by_fkey 
  FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.attorneys DROP CONSTRAINT attorneys_created_by_fkey;
ALTER TABLE public.attorneys ADD CONSTRAINT attorneys_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.email_queue DROP CONSTRAINT email_queue_reviewed_by_fkey;
ALTER TABLE public.email_queue ADD CONSTRAINT email_queue_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expert_payments DROP CONSTRAINT expert_payments_recorded_by_fkey;
ALTER TABLE public.expert_payments ADD CONSTRAINT expert_payments_recorded_by_fkey 
  FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.lead_search_history DROP CONSTRAINT lead_search_history_created_by_fkey;
ALTER TABLE public.lead_search_history ADD CONSTRAINT lead_search_history_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT leads_assigned_to_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT leads_created_by_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pitch_logs DROP CONSTRAINT pitch_logs_created_by_fkey;
ALTER TABLE public.pitch_logs ADD CONSTRAINT pitch_logs_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.security_audit_results DROP CONSTRAINT security_audit_results_resolved_by_fkey;
ALTER TABLE public.security_audit_results ADD CONSTRAINT security_audit_results_resolved_by_fkey 
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.security_audit_results DROP CONSTRAINT security_audit_results_created_by_fkey;
ALTER TABLE public.security_audit_results ADD CONSTRAINT security_audit_results_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.sensitive_data_access_tokens DROP CONSTRAINT sensitive_data_access_tokens_revoked_by_fkey;
ALTER TABLE public.sensitive_data_access_tokens ADD CONSTRAINT sensitive_data_access_tokens_revoked_by_fkey 
  FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_granted_by_fkey;
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_granted_by_fkey 
  FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_granted_by_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_granted_by_fkey 
  FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make uploaded_by nullable on aod_documents since we're using SET NULL
ALTER TABLE public.aod_documents ALTER COLUMN uploaded_by DROP NOT NULL;

-- Make created_by nullable on attorneys since we're using SET NULL  
ALTER TABLE public.attorneys ALTER COLUMN created_by DROP NOT NULL;

-- Make recorded_by nullable on expert_payments since we're using SET NULL
ALTER TABLE public.expert_payments ALTER COLUMN recorded_by DROP NOT NULL;

-- Make created_by nullable on lead_search_history
ALTER TABLE public.lead_search_history ALTER COLUMN created_by DROP NOT NULL;

-- Make created_by nullable on leads
ALTER TABLE public.leads ALTER COLUMN created_by DROP NOT NULL;

-- Make created_by nullable on pitch_logs
ALTER TABLE public.pitch_logs ALTER COLUMN created_by DROP NOT NULL;

-- Make created_by nullable on security_audit_results
ALTER TABLE public.security_audit_results ALTER COLUMN created_by DROP NOT NULL;

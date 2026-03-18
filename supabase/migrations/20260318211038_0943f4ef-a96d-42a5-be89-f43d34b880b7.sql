
-- System settings table for feature flags and visibility controls
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system settings"
ON public.system_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can read system settings"
ON public.system_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'employee'));

-- Record locks table
CREATE TABLE public.record_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  lock_reason text,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(table_name, record_id)
);

ALTER TABLE public.record_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage record locks"
ON public.record_locks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view record locks"
ON public.record_locks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'employee'));

-- Insert default system settings (feature flags, visibility, workflow)
INSERT INTO public.system_settings (setting_key, setting_value, category, description) VALUES
  ('feature_attorney_portal', '{"enabled": true}'::jsonb, 'visibility', 'Attorney Portal access'),
  ('feature_expert_portal', '{"enabled": true}'::jsonb, 'visibility', 'Expert Portal access'),
  ('feature_document_upload', '{"enabled": true}'::jsonb, 'visibility', 'Document upload functionality'),
  ('feature_report_submission', '{"enabled": true}'::jsonb, 'visibility', 'Report submission by experts'),
  ('feature_appointment_requests', '{"enabled": true}'::jsonb, 'visibility', 'Appointment request system'),
  ('feature_email_automation', '{"enabled": true}'::jsonb, 'visibility', 'Automated email sending'),
  ('feature_case_screening', '{"enabled": true}'::jsonb, 'visibility', 'AI case screening'),
  ('feature_pitchlog', '{"enabled": true}'::jsonb, 'visibility', 'Attorney pitchlog module'),
  ('visibility_expert_contacts', '{"show_to_attorneys": false, "show_to_experts": true}'::jsonb, 'visibility', 'Expert contact info visibility'),
  ('visibility_financial_data', '{"show_to_attorneys": true, "show_to_experts": false}'::jsonb, 'visibility', 'Financial data visibility'),
  ('visibility_claimant_contact', '{"show_to_experts": false}'::jsonb, 'visibility', 'Claimant contact info to experts'),
  ('workflow_report_approval', '{"require_approval": true, "auto_approve_admin": true}'::jsonb, 'workflow', 'Report approval workflow'),
  ('workflow_document_approval', '{"require_approval": true, "auto_approve_internal": true}'::jsonb, 'workflow', 'Document upload approval'),
  ('workflow_payment_approval', '{"require_approval": false}'::jsonb, 'workflow', 'Payment recording approval'),
  ('workflow_status_override', '{"allowed_roles": ["admin"]}'::jsonb, 'workflow', 'Status override permissions'),
  ('workflow_email_rules', '{"send_confirmation": true, "send_reminders": true, "reminder_days": 2}'::jsonb, 'workflow', 'Email automation rules'),
  ('deadline_report_days', '{"default": 30, "urgent": 14, "critical": 7}'::jsonb, 'workflow', 'Report deadline thresholds'),
  ('deadline_payment_days', '{"default": 30, "grace_period": 7}'::jsonb, 'workflow', 'Payment deadline thresholds'),
  ('data_retention_days', '{"audit_logs": 365, "proofreading": 30, "expired_tokens": 7}'::jsonb, 'data', 'Data retention policies'),
  ('data_archive_policy', '{"auto_archive": false, "archive_after_months": 12}'::jsonb, 'data', 'Auto-archive policy');

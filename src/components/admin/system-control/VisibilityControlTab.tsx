import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff, Shield, Users, Briefcase, Stethoscope, FileText, Mail, Brain, BarChart3 } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const featureFlagConfig = [
  { key: 'feature_attorney_portal', label: 'Attorney Portal', icon: Briefcase, desc: 'Allow attorneys to access their portal' },
  { key: 'feature_expert_portal', label: 'Expert Portal', icon: Stethoscope, desc: 'Allow experts to access their portal' },
  { key: 'feature_document_upload', label: 'Document Upload', icon: FileText, desc: 'Enable document upload for all users' },
  { key: 'feature_report_submission', label: 'Report Submission', icon: FileText, desc: 'Allow experts to submit reports' },
  { key: 'feature_appointment_requests', label: 'Appointment Requests', icon: Users, desc: 'Enable appointment request system' },
  { key: 'feature_email_automation', label: 'Email Automation', icon: Mail, desc: 'Automated email sending system' },
  { key: 'feature_case_screening', label: 'AI Case Screening', icon: Brain, desc: 'AI-powered case analysis' },
  { key: 'feature_pitchlog', label: 'Attorney Pitchlog', icon: BarChart3, desc: 'Sales pitchlog module' },
];

const visibilityConfig = [
  { key: 'visibility_expert_contacts', label: 'Expert Contact Details', fields: [
    { field: 'show_to_attorneys', label: 'Visible to Attorneys' },
    { field: 'show_to_experts', label: 'Visible to Experts' },
  ]},
  { key: 'visibility_financial_data', label: 'Financial Data', fields: [
    { field: 'show_to_attorneys', label: 'Visible to Attorneys' },
    { field: 'show_to_experts', label: 'Visible to Experts' },
  ]},
  { key: 'visibility_claimant_contact', label: 'Claimant Contact Info', fields: [
    { field: 'show_to_experts', label: 'Visible to Experts' },
  ]},
];

const VisibilityControlTab: React.FC = () => {
  const { settings, isLoading, updateSetting } = useSystemSettings('visibility');

  const getSettingValue = (key: string): Record<string, any> => {
    return settings.find(s => s.setting_key === key)?.setting_value || {};
  };

  const handleFeatureToggle = (key: string, enabled: boolean) => {
    updateSetting.mutate({ key, value: { enabled } });
  };

  const handleVisibilityToggle = (key: string, field: string, value: boolean) => {
    const current = getSettingValue(key);
    updateSetting.mutate({ key, value: { ...current, [field]: value } });
  };

  if (isLoading) {
    return (
      <AdminCard className="mt-4">
        <AdminLoadingState label="Loading visibility settings…" />
      </AdminCard>
    );
  }

  const enabledFeatureCount = featureFlagConfig.filter(
    ({ key }) => getSettingValue(key)?.enabled !== false
  ).length;

  return (
    <div className="mt-4 space-y-4 md:space-y-6">
      {/* Feature Flags */}
      <AdminCard>
        <AdminCardHeader
          icon={Shield}
          title="Feature Flags"
          description="Enable or disable major system features globally"
          actions={
            <AdminPill tone="teal">
              {enabledFeatureCount}/{featureFlagConfig.length} enabled
            </AdminPill>
          }
        />
        <AdminCardBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {featureFlagConfig.map(({ key, label, icon: Icon, desc }) => {
              const val = getSettingValue(key);
              const enabled = val?.enabled !== false;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 border border-black/10 p-3 transition-colors hover:border-black/25"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: enabled ? `${BRAND_TEAL}1A` : 'rgba(0,0,0,0.05)',
                        color: enabled ? BRAND_TEAL : undefined,
                      }}
                    >
                      <Icon className={`h-4 w-4 ${enabled ? '' : 'text-slate-400'}`} style={enabled ? { color: BRAND_TEAL } : undefined} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-black">{label}</p>
                      <p className="truncate text-xs text-slate-500">{desc}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminPill tone={enabled ? 'teal' : 'neutral'}>{enabled ? 'ON' : 'OFF'}</AdminPill>
                    <Switch checked={enabled} onCheckedChange={(checked) => handleFeatureToggle(key, checked)} />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Data Visibility Rules */}
      <AdminCard>
        <AdminCardHeader
          icon={Eye}
          title="Data Visibility Rules"
          description="Control which sensitive data fields are visible to different user roles"
        />
        <AdminCardBody className="space-y-3">
          {visibilityConfig.map(({ key, label, fields }) => {
            const val = getSettingValue(key);
            return (
              <div key={key} className="border border-black/10 p-4">
                <h4 className="mb-3 text-sm font-semibold text-black">{label}</h4>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {fields.map(({ field, label: fieldLabel }) => (
                    <div key={field} className="flex items-center gap-2">
                      {val?.[field] ? (
                        <Eye className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className="text-xs text-slate-600">{fieldLabel}</span>
                      <Switch
                        checked={val?.[field] === true}
                        onCheckedChange={(checked) => handleVisibilityToggle(key, field, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </AdminCardBody>
      </AdminCard>
    </div>
  );
};

export default VisibilityControlTab;

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Shield, Users, Briefcase, Stethoscope, FileText, Mail, Brain, BarChart3 } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';

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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 mt-4">
      {/* Feature Flags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Feature Flags
          </CardTitle>
          <CardDescription className="text-xs">
            Enable or disable major system features globally
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {featureFlagConfig.map(({ key, label, icon: Icon, desc }) => {
              const val = getSettingValue(key);
              const enabled = val?.enabled !== false;
              return (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={enabled ? 'default' : 'secondary'} className="text-[10px]">
                      {enabled ? 'ON' : 'OFF'}
                    </Badge>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleFeatureToggle(key, checked)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data Visibility Rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Data Visibility Rules
          </CardTitle>
          <CardDescription className="text-xs">
            Control which sensitive data fields are visible to different user roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {visibilityConfig.map(({ key, label, fields }) => {
              const val = getSettingValue(key);
              return (
                <div key={key} className="p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-medium mb-3">{label}</h4>
                  <div className="flex flex-wrap gap-4">
                    {fields.map(({ field, label: fieldLabel }) => (
                      <div key={field} className="flex items-center gap-2">
                        {val?.[field] ? (
                          <Eye className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="text-xs">{fieldLabel}</span>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisibilityControlTab;

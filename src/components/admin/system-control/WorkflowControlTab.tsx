import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, Mail, Shield } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminSectionLabel,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const flatInput = 'rounded-none border-black/15';

/** Shared row treatment for every toggle line inside a workflow card. */
const ToggleRow: React.FC<{ label: string; checked: boolean; onCheckedChange: (v: boolean) => void }> = ({
  label,
  checked,
  onCheckedChange,
}) => (
  <div className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2.5">
    <span className="text-xs text-slate-600">{label}</span>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const WorkflowControlTab: React.FC = () => {
  const { settings, isLoading, updateSetting } = useSystemSettings('workflow');

  const getVal = (key: string) => settings.find(s => s.setting_key === key)?.setting_value || {};

  // Status override section
  const [overrideTable, setOverrideTable] = useState('appointments');
  const [overrideRecordId, setOverrideRecordId] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('');

  const handleStatusOverride = async () => {
    if (!overrideRecordId || !overrideStatus) {
      toast.error('Please provide record ID and new status');
      return;
    }
    try {
      const statusField = overrideTable === 'appointments' ? 'case_status' :
                          overrideTable === 'expert_reports' ? 'report_status' :
                          'payment_status';

      const { error } = await supabase
        .from(overrideTable as any)
        .update({ [statusField]: overrideStatus, updated_at: new Date().toISOString() } as any)
        .eq('id', overrideRecordId);

      if (error) throw error;
      toast.success(`Status overridden to "${overrideStatus}"`);
      setOverrideRecordId('');
      setOverrideStatus('');
    } catch (e: any) {
      toast.error('Override failed: ' + e.message);
    }
  };

  if (isLoading) {
    return (
      <AdminCard className="mt-4">
        <AdminLoadingState label="Loading workflow settings…" />
      </AdminCard>
    );
  }

  const reportApproval = getVal('workflow_report_approval');
  const docApproval = getVal('workflow_document_approval');
  const paymentApproval = getVal('workflow_payment_approval');
  const emailRules = getVal('workflow_email_rules');
  const reportDeadlines = getVal('deadline_report_days');
  const paymentDeadlines = getVal('deadline_payment_days');

  return (
    <div className="mt-4 space-y-4 md:space-y-6">
      {/* Approval Workflows — three focused cards instead of one crowded grid */}
      <div>
        <AdminSectionLabel>Approval Workflows</AdminSectionLabel>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <AdminCard>
            <AdminCardHeader icon={CheckCircle} title="Report Approval" />
            <AdminCardBody className="space-y-2">
              <ToggleRow
                label="Require approval"
                checked={reportApproval?.require_approval !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_report_approval', value: { ...reportApproval, require_approval: v } })}
              />
              <ToggleRow
                label="Auto-approve admin uploads"
                checked={reportApproval?.auto_approve_admin !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_report_approval', value: { ...reportApproval, auto_approve_admin: v } })}
              />
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader icon={CheckCircle} title="Document Approval" />
            <AdminCardBody className="space-y-2">
              <ToggleRow
                label="Require approval"
                checked={docApproval?.require_approval !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_document_approval', value: { ...docApproval, require_approval: v } })}
              />
              <ToggleRow
                label="Auto-approve internal"
                checked={docApproval?.auto_approve_internal !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_document_approval', value: { ...docApproval, auto_approve_internal: v } })}
              />
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader icon={CheckCircle} title="Payment Recording" />
            <AdminCardBody className="space-y-2">
              <ToggleRow
                label="Require approval"
                checked={paymentApproval?.require_approval === true}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_payment_approval', value: { ...paymentApproval, require_approval: v } })}
              />
            </AdminCardBody>
          </AdminCard>
        </div>
      </div>

      {/* Status Override */}
      <AdminCard>
        <AdminCardHeader
          icon={Shield}
          title="Status Override"
          description="Force-change record statuses (admin only)"
        />
        <AdminCardBody>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Table</Label>
              <Select value={overrideTable} onValueChange={setOverrideTable}>
                <SelectTrigger className={`h-9 w-40 ${flatInput}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="appointments">Appointments</SelectItem>
                  <SelectItem value="expert_reports">Expert Reports</SelectItem>
                  <SelectItem value="aod_documents">AOD Documents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Record ID</Label>
              <Input className={`h-9 w-64 ${flatInput}`} placeholder="Paste record UUID" value={overrideRecordId} onChange={e => setOverrideRecordId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">New Status</Label>
              <Input className={`h-9 w-40 ${flatInput}`} placeholder="e.g. completed" value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)} />
            </div>
            <Button size="sm" variant="destructive" className="rounded-none" onClick={handleStatusOverride}>
              <Shield className="mr-1 h-3.5 w-3.5" /> Override
            </Button>
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Email Automation Rules */}
      <AdminCard>
        <AdminCardHeader icon={Mail} title="Email Automation Rules" />
        <AdminCardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between border border-black/10 p-3">
              <span className="text-sm text-black">Send Confirmations</span>
              <Switch
                checked={emailRules?.send_confirmation !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_email_rules', value: { ...emailRules, send_confirmation: v } })}
              />
            </div>
            <div className="flex items-center justify-between border border-black/10 p-3">
              <span className="text-sm text-black">Send Reminders</span>
              <Switch
                checked={emailRules?.send_reminders !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_email_rules', value: { ...emailRules, send_reminders: v } })}
              />
            </div>
            <div className="flex items-center gap-2 border border-black/10 p-3">
              <span className="text-sm text-black">Reminder Days Before</span>
              <Input
                type="number"
                className={`h-8 w-16 ${flatInput}`}
                value={emailRules?.reminder_days || 2}
                onChange={(e) => updateSetting.mutate({ key: 'workflow_email_rules', value: { ...emailRules, reminder_days: parseInt(e.target.value) || 2 } })}
              />
            </div>
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Deadline Management */}
      <AdminCard>
        <AdminCardHeader icon={Clock} title="Deadline Thresholds" />
        <AdminCardBody className="space-y-5">
          <div>
            <AdminSectionLabel>Report Deadlines (days)</AdminSectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {['default', 'urgent', 'critical'].map(level => (
                <div key={level} className="space-y-1">
                  <Label className="text-[11px] capitalize text-slate-500">{level}</Label>
                  <Input
                    type="number"
                    className={`h-8 ${flatInput}`}
                    value={reportDeadlines?.[level] || 0}
                    onChange={e => updateSetting.mutate({ key: 'deadline_report_days', value: { ...reportDeadlines, [level]: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <AdminSectionLabel>Payment Deadlines (days)</AdminSectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {['default', 'grace_period'].map(level => (
                <div key={level} className="space-y-1">
                  <Label className="text-[11px] capitalize text-slate-500">{level.replace('_', ' ')}</Label>
                  <Input
                    type="number"
                    className={`h-8 ${flatInput}`}
                    value={paymentDeadlines?.[level] || 0}
                    onChange={e => updateSetting.mutate({ key: 'deadline_payment_days', value: { ...paymentDeadlines, [level]: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              ))}
            </div>
          </div>
        </AdminCardBody>
      </AdminCard>
    </div>
  );
};

export default WorkflowControlTab;

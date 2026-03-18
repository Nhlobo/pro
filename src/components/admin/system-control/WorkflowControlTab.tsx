import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitBranch, CheckCircle, Clock, Mail, AlertTriangle, Shield, Save } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const reportApproval = getVal('workflow_report_approval');
  const docApproval = getVal('workflow_document_approval');
  const paymentApproval = getVal('workflow_payment_approval');
  const emailRules = getVal('workflow_email_rules');
  const reportDeadlines = getVal('deadline_report_days');
  const paymentDeadlines = getVal('deadline_payment_days');

  return (
    <div className="space-y-6 mt-4">
      {/* Approval Workflows */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Approval Workflows
          </CardTitle>
          <CardDescription className="text-xs">Configure which actions require approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Report Approval */}
            <div className="p-4 rounded-lg border border-border space-y-3">
              <h4 className="text-sm font-medium">Report Approval</h4>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Require approval</span>
                <Switch
                  checked={reportApproval?.require_approval !== false}
                  onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_report_approval', value: { ...reportApproval, require_approval: v } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Auto-approve admin uploads</span>
                <Switch
                  checked={reportApproval?.auto_approve_admin !== false}
                  onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_report_approval', value: { ...reportApproval, auto_approve_admin: v } })}
                />
              </div>
            </div>

            {/* Document Approval */}
            <div className="p-4 rounded-lg border border-border space-y-3">
              <h4 className="text-sm font-medium">Document Approval</h4>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Require approval</span>
                <Switch
                  checked={docApproval?.require_approval !== false}
                  onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_document_approval', value: { ...docApproval, require_approval: v } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Auto-approve internal</span>
                <Switch
                  checked={docApproval?.auto_approve_internal !== false}
                  onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_document_approval', value: { ...docApproval, auto_approve_internal: v } })}
                />
              </div>
            </div>

            {/* Payment Approval */}
            <div className="p-4 rounded-lg border border-border space-y-3">
              <h4 className="text-sm font-medium">Payment Recording</h4>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Require approval</span>
                <Switch
                  checked={paymentApproval?.require_approval === true}
                  onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_payment_approval', value: { ...paymentApproval, require_approval: v } })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Override */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            Status Override
          </CardTitle>
          <CardDescription className="text-xs">Force-change record statuses (admin only)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Table</Label>
              <Select value={overrideTable} onValueChange={setOverrideTable}>
                <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="appointments">Appointments</SelectItem>
                  <SelectItem value="expert_reports">Expert Reports</SelectItem>
                  <SelectItem value="aod_documents">AOD Documents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Record ID</Label>
              <Input className="w-64 h-9" placeholder="Paste record UUID" value={overrideRecordId} onChange={e => setOverrideRecordId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">New Status</Label>
              <Input className="w-40 h-9" placeholder="e.g. completed" value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)} />
            </div>
            <Button size="sm" variant="destructive" onClick={handleStatusOverride}>
              <Shield className="h-3.5 w-3.5 mr-1" /> Override
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Automation Rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Email Automation Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <span className="text-sm">Send Confirmations</span>
              <Switch
                checked={emailRules?.send_confirmation !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_email_rules', value: { ...emailRules, send_confirmation: v } })}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <span className="text-sm">Send Reminders</span>
              <Switch
                checked={emailRules?.send_reminders !== false}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'workflow_email_rules', value: { ...emailRules, send_reminders: v } })}
              />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
              <span className="text-sm">Reminder Days Before</span>
              <Input
                type="number"
                className="w-16 h-8"
                value={emailRules?.reminder_days || 2}
                onChange={(e) => updateSetting.mutate({ key: 'workflow_email_rules', value: { ...emailRules, reminder_days: parseInt(e.target.value) || 2 } })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deadline Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Deadline Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Report Deadlines (days)</h4>
              <div className="grid grid-cols-3 gap-2">
                {['default', 'urgent', 'critical'].map(level => (
                  <div key={level} className="space-y-1">
                    <Label className="text-xs capitalize">{level}</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={reportDeadlines?.[level] || 0}
                      onChange={e => updateSetting.mutate({ key: 'deadline_report_days', value: { ...reportDeadlines, [level]: parseInt(e.target.value) || 0 } })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Payment Deadlines (days)</h4>
              <div className="grid grid-cols-2 gap-2">
                {['default', 'grace_period'].map(level => (
                  <div key={level} className="space-y-1">
                    <Label className="text-xs capitalize">{level.replace('_', ' ')}</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={paymentDeadlines?.[level] || 0}
                      onChange={e => updateSetting.mutate({ key: 'deadline_payment_days', value: { ...paymentDeadlines, [level]: parseInt(e.target.value) || 0 } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowControlTab;
